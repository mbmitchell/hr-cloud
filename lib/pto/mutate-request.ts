import { dateToDateOnlyString, parseDateOnly } from "../date-only";
import {
  getLedgerBucketForLeaveType,
  isBalanceTrackedLeaveType,
} from "./leave-types";
import { writeAuditLog } from "../server/audit/write-audit-log";

export const PTO_REQUEST_STATUSES = [
  "PENDING",
  "APPROVED",
  "DENIED",
  "CANCELLED",
] as const;

export type PtoRequestStatus = (typeof PTO_REQUEST_STATUSES)[number];

type PTORequestRecord = {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  status: string;
  approverId: string | null;
  notes: string | null;
  approvalComment: string | null;
  decisionAt: Date | null;
  decidedBy: string | null;
};

type PtoRequestMutationTx = {
  pTORequest: {
    update(args: unknown): Promise<PTORequestRecord>;
  };
  pTORequestAction: {
    create(args: unknown): Promise<unknown>;
  };
  pTOLedger: {
    findUnique(args: unknown): Promise<{ id: string } | null>;
    findFirst(args: unknown): Promise<{ balance: number } | null>;
    create(args: unknown): Promise<{ id: string }>;
  };
  auditLog: {
    create(args: unknown): Promise<unknown>;
  };
};

type RequestEffect = {
  bucket: "PTO" | "COMP";
  hours: number;
};

function getTrackedRequestEffect(input: {
  leaveType: string;
  hours: number;
  status: string;
}): RequestEffect | null {
  if (input.status !== "APPROVED" || !isBalanceTrackedLeaveType(input.leaveType)) {
    return null;
  }

  return {
    bucket: getLedgerBucketForLeaveType(input.leaveType),
    hours: input.hours,
  };
}

function effectsMatch(left: RequestEffect | null, right: RequestEffect | null) {
  if (!left && !right) {
    return true;
  }

  if (!left || !right) {
    return false;
  }

  return left.bucket === right.bucket && Math.abs(left.hours - right.hours) < 0.01;
}

function roundHours(value: number) {
  return Number(value.toFixed(2));
}

function getInclusiveDateSpanDays(startDate: Date, endDate: Date) {
  const normalizedStart = parseDateOnly(dateToDateOnlyString(startDate));
  const normalizedEnd = parseDateOnly(dateToDateOnlyString(endDate));

  if (!normalizedStart || !normalizedEnd || normalizedEnd < normalizedStart) {
    return null;
  }

  const millisecondsPerDay = 24 * 60 * 60 * 1000;
  return (
    Math.round(
      (normalizedEnd.getTime() - normalizedStart.getTime()) / millisecondsPerDay
    ) + 1
  );
}

async function appendLedgerEntry(
  tx: PtoRequestMutationTx,
  input: {
    employeeId: string;
    bucket: "PTO" | "COMP";
    type: string;
    signedHours: number;
    notes: string;
    sourceRequestId?: string;
    idempotencyKey?: string;
  }
) {
  const latestLedger = await tx.pTOLedger.findFirst({
    where: {
      employeeId: input.employeeId,
      bucket: input.bucket,
    },
    orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
  });

  const currentBalance = latestLedger?.balance ?? 0;
  const newBalance = roundHours(currentBalance + input.signedHours);

  return tx.pTOLedger.create({
    data: {
      employeeId: input.employeeId,
      bucket: input.bucket,
      type: input.type,
      hours: input.signedHours,
      balance: newBalance,
      effectiveDate: new Date(),
      notes: input.notes,
      ...(input.sourceRequestId
        ? {
            sourceRequestId: input.sourceRequestId,
          }
        : {}),
      ...(input.idempotencyKey
        ? {
            idempotencyKey: input.idempotencyKey,
          }
        : {}),
    },
  });
}

function getActionName(input: {
  oldStatus: string;
  newStatus: PtoRequestStatus;
}) {
  if (input.oldStatus !== input.newStatus) {
    switch (input.newStatus) {
      case "APPROVED":
        return {
          requestAction: "APPROVED",
          auditAction: "REQUEST_APPROVED",
        };
      case "DENIED":
        return {
          requestAction: "DENIED",
          auditAction: "REQUEST_DENIED",
        };
      case "CANCELLED":
        return {
          requestAction: "CANCELLED",
          auditAction: "REQUEST_CANCELLED",
        };
      case "PENDING":
      default:
        return {
          requestAction: "REOPENED",
          auditAction: "REQUEST_REOPENED",
        };
    }
  }

  return {
    requestAction: "UPDATED",
    auditAction: "REQUEST_UPDATED",
  };
}

export async function mutatePtoRequest(
  tx: PtoRequestMutationTx,
  params: {
    actorId: string;
    existingRequest: PTORequestRecord;
    nextValues: {
      leaveType: string;
      startDate: Date;
      endDate: Date;
      hours: number;
      status: PtoRequestStatus;
      notes: string | null;
      approvalComment: string | null;
    };
  }
) {
  const { existingRequest, nextValues } = params;
  const oldEffect = getTrackedRequestEffect(existingRequest);
  const newEffect = getTrackedRequestEffect(nextValues);
  const needsLedgerAdjustment = !effectsMatch(oldEffect, newEffect);
  const existingSourceLedgerEntry = await tx.pTOLedger.findUnique({
    where: {
      sourceRequestId: existingRequest.id,
    },
  });
  const now = new Date();

  if (needsLedgerAdjustment && oldEffect) {
    await appendLedgerEntry(tx, {
      employeeId: existingRequest.employeeId,
      bucket: oldEffect.bucket,
      type: "MANUAL_ADD",
      signedHours: oldEffect.hours,
      notes: `Reversed approved ${existingRequest.leaveType} request ${existingRequest.id} during PTO request update.`,
    });
  }

  if (needsLedgerAdjustment && newEffect) {
    if (!existingSourceLedgerEntry) {
      await appendLedgerEntry(tx, {
        employeeId: existingRequest.employeeId,
        bucket: newEffect.bucket,
        type: "USAGE",
        signedHours: -newEffect.hours,
        notes: `Approved ${nextValues.leaveType} request ${existingRequest.id}${
          nextValues.approvalComment ? ` - ${nextValues.approvalComment}` : ""
        }`,
        sourceRequestId: existingRequest.id,
        idempotencyKey: `request-approval:${existingRequest.id}`,
      });
    } else {
      await appendLedgerEntry(tx, {
        employeeId: existingRequest.employeeId,
        bucket: newEffect.bucket,
        type: "MANUAL_SUBTRACT",
        signedHours: -newEffect.hours,
        notes: `Applied updated approved ${nextValues.leaveType} request ${existingRequest.id} during PTO request update.`,
      });
    }
  }

  const nextStatus = nextValues.status;
  const decisionFields =
    nextStatus === "PENDING"
      ? {
          approverId: null,
          approvalComment: null,
          decisionAt: null,
          decidedBy: null,
        }
      : existingRequest.status !== nextStatus
        ? {
            approverId: params.actorId,
            approvalComment: nextValues.approvalComment,
            decisionAt: now,
            decidedBy: params.actorId,
          }
        : {
            approverId: existingRequest.approverId,
            approvalComment: nextValues.approvalComment,
            decisionAt: existingRequest.decisionAt,
            decidedBy: existingRequest.decidedBy,
          };

  const updatedRequest = await tx.pTORequest.update({
    where: {
      id: existingRequest.id,
    },
    data: {
      leaveType: nextValues.leaveType,
      startDate: nextValues.startDate,
      endDate: nextValues.endDate,
      hours: nextValues.hours,
      status: nextStatus,
      notes: nextValues.notes,
      ...decisionFields,
    },
  });

  const { requestAction, auditAction } = getActionName({
    oldStatus: existingRequest.status,
    newStatus: nextStatus,
  });

  await tx.pTORequestAction.create({
    data: {
      requestId: updatedRequest.id,
      action: requestAction,
      actionById: params.actorId,
      comment:
        nextStatus === "PENDING"
          ? "Request reopened for further review."
          : nextValues.approvalComment ?? nextValues.notes,
    },
  });

  await writeAuditLog(tx, {
    userId: params.actorId,
    action: auditAction,
    entityType: "PTORequest",
    entityId: updatedRequest.id,
    oldValue: {
      employeeId: existingRequest.employeeId,
      leaveType: existingRequest.leaveType,
      startDate: dateToDateOnlyString(existingRequest.startDate),
      endDate: dateToDateOnlyString(existingRequest.endDate),
      dateSpanDays: getInclusiveDateSpanDays(
        existingRequest.startDate,
        existingRequest.endDate
      ),
      hours: existingRequest.hours,
      status: existingRequest.status,
      notes: existingRequest.notes,
      approvalComment: existingRequest.approvalComment,
    },
    newValue: {
      employeeId: updatedRequest.employeeId,
      leaveType: updatedRequest.leaveType,
      startDate: dateToDateOnlyString(updatedRequest.startDate),
      endDate: dateToDateOnlyString(updatedRequest.endDate),
      dateSpanDays: getInclusiveDateSpanDays(
        updatedRequest.startDate,
        updatedRequest.endDate
      ),
      hours: updatedRequest.hours,
      status: updatedRequest.status,
      notes: updatedRequest.notes,
      approvalComment: updatedRequest.approvalComment,
      ledgerAdjusted: needsLedgerAdjustment,
      oldLedgerBucket: oldEffect?.bucket ?? null,
      newLedgerBucket: newEffect?.bucket ?? null,
    },
  });

  return {
    updatedRequest,
    statusChanged: existingRequest.status !== updatedRequest.status,
    oldStatus: existingRequest.status,
    newStatus: updatedRequest.status,
    ledgerAdjusted: needsLedgerAdjustment,
  };
}

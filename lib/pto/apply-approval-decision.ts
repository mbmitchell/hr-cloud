/**
 * PTO Approval Mutation Helper
 *
 * Applies the database-side effects of approving or denying a PTO request
 * inside a caller-managed transaction.
 *
 * Responsibilities:
 * - Transition request status from PENDING to APPROVED/DENIED
 * - Record request action history
 * - Post PTO/COMP ledger usage when the leave type consumes balance
 * - Write an audit record describing the decision
 *
 * Business rules:
 * - Workflow-only leave such as bereavement is approved normally but never
 *   deducts PTO or COMP balance
 * - PTO/COMP usage deductions are tied to the request for duplicate protection
 */
import {
  getLedgerBucketForLeaveType,
  isWorkflowOnlyLeaveType,
} from "./leave-types";

type ApprovalDecision = "APPROVED" | "DENIED";

type PTORequestRecord = {
  id: string;
  employeeId: string;
  leaveType: string;
  hours: number;
  status: string;
  approvalComment: string | null;
};

type ApprovalTx = {
  pTORequest: {
    updateMany(args: unknown): Promise<{ count: number }>;
    findUnique(args: unknown): Promise<PTORequestRecord | null>;
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

export async function applyApprovalDecision(
  tx: ApprovalTx,
  params: {
    requestId: string;
    status: ApprovalDecision;
    approvalComment: string | null;
    actorId: string;
    existingRequest: PTORequestRecord;
  }
) {
  /**
   * Duplicate protection for balance-affecting approvals. If a request already
   * created a usage ledger row, a retry should fail instead of deducting time
   * twice.
   */
  const duplicateLedgerEntry = await tx.pTOLedger.findUnique({
    where: { sourceRequestId: params.requestId },
  });

  if (params.status === "APPROVED" && duplicateLedgerEntry) {
    throw new Error("Approval has already been posted to the PTO ledger.");
  }

  const updateResult = await tx.pTORequest.updateMany({
    where: {
      id: params.requestId,
      status: "PENDING",
    },
    data: {
      status: params.status,
      approverId: params.actorId,
      approvalComment: params.approvalComment,
      decisionAt: new Date(),
      decidedBy: params.actorId,
    },
  });

  if (updateResult.count !== 1) {
    throw new Error("Only pending requests can be processed.");
  }

  const updatedRequest = await tx.pTORequest.findUnique({
    where: { id: params.requestId },
  });

  if (!updatedRequest) {
    throw new Error("PTO request not found.");
  }

  await tx.pTORequestAction.create({
    data: {
      requestId: updatedRequest.id,
      action: params.status,
      actionById: params.actorId,
      comment: params.approvalComment,
    },
  });

  if (params.status === "APPROVED" && !isWorkflowOnlyLeaveType(params.existingRequest.leaveType)) {
    // Only leave types that consume a tracked balance should touch the PTO
    // ledger. Workflow-only leave remains status/history/audit only.
    const bucket = getLedgerBucketForLeaveType(params.existingRequest.leaveType);

    const latestLedger = await tx.pTOLedger.findFirst({
      where: {
        employeeId: params.existingRequest.employeeId,
        bucket,
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    });

    const currentBalance = latestLedger?.balance ?? 0;
    const newBalance = currentBalance - params.existingRequest.hours;

    const ledgerEntry = await tx.pTOLedger.create({
      data: {
        employeeId: params.existingRequest.employeeId,
        bucket,
        type: "USAGE",
        hours: -params.existingRequest.hours,
        balance: newBalance,
        effectiveDate: new Date(),
        sourceRequestId: params.existingRequest.id,
        idempotencyKey: `request-approval:${params.existingRequest.id}`,
        notes: `Approved ${params.existingRequest.leaveType} request ${params.existingRequest.id}${
          params.approvalComment ? ` - ${params.approvalComment}` : ""
        }`,
      },
    });

    await tx.auditLog.create({
      data: {
        userId: params.actorId,
        action: "REQUEST_APPROVED",
        entityType: "PTORequest",
        entityId: updatedRequest.id,
        oldValue: JSON.stringify({
          status: params.existingRequest.status,
          approvalComment: params.existingRequest.approvalComment,
        }),
        newValue: JSON.stringify({
          status: updatedRequest.status,
          approvalComment: updatedRequest.approvalComment,
          ledgerEntryId: ledgerEntry.id,
          bucket,
        }),
      },
    });

    return updatedRequest;
  }

  await tx.auditLog.create({
    data: {
      userId: params.actorId,
      action:
        params.status === "DENIED" ? "REQUEST_DENIED" : "REQUEST_APPROVED",
      entityType: "PTORequest",
      entityId: updatedRequest.id,
      oldValue: JSON.stringify({
        status: params.existingRequest.status,
        approvalComment: params.existingRequest.approvalComment,
      }),
      newValue: JSON.stringify({
        status: updatedRequest.status,
        approvalComment: updatedRequest.approvalComment,
        ledgerEntryId: null,
        workflowOnly: isWorkflowOnlyLeaveType(params.existingRequest.leaveType),
      }),
    },
  });

  return updatedRequest;
}

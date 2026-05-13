import { Prisma } from "@prisma/client";

import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { resolvePtoRequestHours } from "../../../../lib/company-holidays/service";
import { dateToDateOnlyString, parseDateOnly } from "../../../../lib/date-only";
import { dispatchCalendarSyncInBackground } from "../../../../lib/notifications/calendar/dispatch";
import { createApprovedPtoCalendarEvent } from "../../../../lib/notifications/calendar/create-event";
import {
  mutatePtoRequest,
  PTO_REQUEST_STATUSES,
  type PtoRequestStatus,
} from "../../../../lib/pto/mutate-request";
import { isLeaveType } from "../../../../lib/pto/leave-types";
import {
  assertCanManagePtoRequest,
  isAuthorizationError,
  requireActor,
} from "../../../../lib/server/authorization";
import { enqueuePtoNotifications } from "../../../../lib/server/hr-notifications/pto";

function serializeRequest(request: {
  id: string;
  employeeId: string;
  leaveType: string;
  startDate: Date;
  endDate: Date;
  hours: number;
  status: string;
  notes: string | null;
  approvalComment: string | null;
}) {
  return {
    ...request,
    startDate: dateToDateOnlyString(request.startDate),
    endDate: dateToDateOnlyString(request.endDate),
    notes: request.notes ?? "",
    approvalComment: request.approvalComment ?? "",
  };
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const requestId = String(id || "").trim();

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required." }, { status: 400 });
    }

    const actor = await requireActor();
    const actorId = actor.id;
    const body = await request.json();

    const leaveType = String(body.leaveType || "").trim();
    const startDate = String(body.startDate || "").trim();
    const endDate = String(body.endDate || "").trim();
    const hours = Number(body.hours);
    const statusValue = String(body.status || "").trim();
    const notes = body.notes ? String(body.notes).trim() : null;
    const approvalComment = body.approvalComment
      ? String(body.approvalComment).trim()
      : null;

    if (
      !leaveType ||
      !startDate ||
      !endDate ||
      !Number.isFinite(hours) ||
      !statusValue
    ) {
      return NextResponse.json(
        { error: "Leave type, dates, hours, and status are required." },
        { status: 400 }
      );
    }

    if (!isLeaveType(leaveType)) {
      return NextResponse.json({ error: "Leave type is invalid." }, { status: 400 });
    }

    if (!(PTO_REQUEST_STATUSES as readonly string[]).includes(statusValue)) {
      return NextResponse.json({ error: "Status is invalid." }, { status: 400 });
    }

    const parsedStartDate = parseDateOnly(startDate);
    const parsedEndDate = parseDateOnly(endDate);

    if (!parsedStartDate || !parsedEndDate) {
      return NextResponse.json({ error: "Dates must be valid." }, { status: 400 });
    }

    if (parsedEndDate < parsedStartDate) {
      return NextResponse.json(
        { error: "End date cannot be earlier than start date." },
        { status: 400 }
      );
    }

    if (statusValue === "DENIED" && !approvalComment) {
      return NextResponse.json(
        { error: "A deny reason is required." },
        { status: 400 }
      );
    }

    const existingRequest = await prisma.pTORequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        employeeId: true,
        leaveType: true,
        startDate: true,
        endDate: true,
        hours: true,
        status: true,
        approverId: true,
        notes: true,
        approvalComment: true,
        decisionAt: true,
        decidedBy: true,
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "PTO request not found." }, { status: 404 });
    }

    await assertCanManagePtoRequest(actorId, requestId);

    const resolvedHours = await resolvePtoRequestHours(prisma, {
      startDate: parsedStartDate,
      endDate: parsedEndDate,
      requestedHours: hours,
    });

    if (!resolvedHours.ok) {
      return NextResponse.json(
        {
          error: resolvedHours.error,
          summary: resolvedHours.summary,
        },
        { status: 400 }
      );
    }

    const nextStatus = statusValue as PtoRequestStatus;
    const unchanged =
      existingRequest.leaveType === leaveType &&
      dateToDateOnlyString(existingRequest.startDate) === startDate &&
      dateToDateOnlyString(existingRequest.endDate) === endDate &&
      Math.abs(existingRequest.hours - resolvedHours.value.hours) < 0.01 &&
      existingRequest.status === nextStatus &&
      (existingRequest.notes ?? null) === notes &&
      (existingRequest.approvalComment ?? null) ===
        (nextStatus === "PENDING" ? null : approvalComment);

    if (unchanged) {
      return NextResponse.json({
        success: true,
        unchanged: true,
        request: serializeRequest(existingRequest),
      });
    }

    const result = await prisma.$transaction(
      async (tx) =>
        mutatePtoRequest(tx, {
          actorId,
          existingRequest,
          nextValues: {
            leaveType,
            startDate: parsedStartDate,
            endDate: parsedEndDate,
            hours: resolvedHours.value.hours,
            status: nextStatus,
            notes,
            approvalComment,
            calculationSummary: resolvedHours.value.summary,
          },
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    try {
      if (
        result.oldStatus !== "APPROVED" &&
        result.newStatus === "APPROVED"
      ) {
        await enqueuePtoNotifications({
          eventType: "PTO_REQUEST_APPROVED",
          requestId,
          actorId,
        });

        dispatchCalendarSyncInBackground(async () => {
          await createApprovedPtoCalendarEvent({ requestId });
        });
      } else if (
        result.oldStatus !== "DENIED" &&
        result.newStatus === "DENIED"
      ) {
        await enqueuePtoNotifications({
          eventType: "PTO_REQUEST_DENIED",
          requestId,
          actorId,
        });
      }
    } catch (error) {
      console.error("Failed to enqueue PTO update notifications:", error);
    }

    return NextResponse.json({
      success: true,
      request: serializeRequest(result.updatedRequest),
      ledgerAdjusted: result.ledgerAdjusted,
      calculationSummary: resolvedHours.value.summary,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to update PTO request:", error);
    return NextResponse.json(
      { error: "Failed to update PTO request." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const requestId = String(id || "").trim();

    if (!requestId) {
      return NextResponse.json({ error: "Request ID is required." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const cancellationComment = body.approvalComment
      ? String(body.approvalComment).trim()
      : null;
    const actor = await requireActor();
    const actorId = actor.id;
    const access = await assertCanManagePtoRequest(actorId, requestId, {
      allowSelfPendingCancel: true,
    });

    const existingRequest = await prisma.pTORequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        employeeId: true,
        leaveType: true,
        startDate: true,
        endDate: true,
        hours: true,
        status: true,
        approverId: true,
        notes: true,
        approvalComment: true,
        decisionAt: true,
        decidedBy: true,
      },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "PTO request not found." }, { status: 404 });
    }

    await assertCanManagePtoRequest(actorId, requestId, {
      allowSelfPendingCancel: true,
    });

    if (existingRequest.status === "CANCELLED") {
      return NextResponse.json(
        { error: "This request has already been cancelled." },
        { status: 400 }
      );
    }

    const result = await prisma.$transaction(
      async (tx) =>
        mutatePtoRequest(tx, {
          actorId,
          existingRequest,
          nextValues: {
            leaveType: existingRequest.leaveType,
            startDate: existingRequest.startDate,
            endDate: existingRequest.endDate,
            hours: existingRequest.hours,
            status: "CANCELLED",
            notes: existingRequest.notes,
            approvalComment:
              cancellationComment ??
              (access.scope === "SELF_PENDING_CANCEL"
                ? "Cancelled by employee"
                : "Cancelled by manager/admin"),
          },
        }),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return NextResponse.json({
      success: true,
      request: serializeRequest(result.updatedRequest),
      ledgerAdjusted: result.ledgerAdjusted,
      cancellationMode: "soft",
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    console.error("Failed to cancel PTO request:", error);
    return NextResponse.json(
      { error: "Failed to cancel PTO request." },
      { status: 500 }
    );
  }
}

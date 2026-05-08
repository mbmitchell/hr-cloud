/**
 * PTO Approval API Route
 *
 * Processes manager/admin approval decisions for pending PTO requests.
 *
 * Responsibilities:
 * - Validate the approval payload
 * - Enforce approver authorization
 * - Apply the status change and any ledger mutation transactionally
 * - Trigger post-commit notifications and Outlook calendar sync
 *
 * Security considerations:
 * - Approval authority is validated server-side from internal roles,
 *   permissions, and reporting relationships
 * - Notifications and calendar sync happen only after the database write
 *   succeeds
 */
import { Prisma } from "@prisma/client";

import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";
import { applyApprovalDecision } from "../../../lib/pto/apply-approval-decision";
import {
  assertCanApproveRequest,
  isAuthorizationError,
  requireActor,
} from "../../../lib/server/authorization";
import { enqueuePtoNotifications } from "../../../lib/server/hr-notifications/pto";
import { dispatchCalendarSyncInBackground } from "../../../lib/notifications/calendar/dispatch";
import { createApprovedPtoCalendarEvent } from "../../../lib/notifications/calendar/create-event";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const requestId = String(body.requestId || "").trim();
    const statusValue = String(body.status || "").trim();
    const approvalComment = body.approvalComment
      ? String(body.approvalComment).trim()
      : null;

    if (!requestId || !["APPROVED", "DENIED"].includes(statusValue)) {
      return NextResponse.json(
        { error: "Invalid approval payload." },
        { status: 400 }
      );
    }

    const status = statusValue as "APPROVED" | "DENIED";
    const actor = await requireActor();

    if (status === "DENIED" && !approvalComment) {
      return NextResponse.json(
        { error: "A deny reason is required." },
        { status: 400 }
      );
    }

    const existingRequest = await prisma.pTORequest.findUnique({
      where: { id: requestId },
    });

    if (!existingRequest) {
      return NextResponse.json(
        { error: "PTO request not found." },
        { status: 404 }
      );
    }

    if (existingRequest.status !== "PENDING") {
      return NextResponse.json(
        { error: "Only pending requests can be processed." },
        { status: 400 }
      );
    }

    // SECURITY:
    // Approval rights are derived from internal relationship and role data.
    // The route stays thin by delegating that decision to the centralized
    // authorization layer rather than trusting client UI state.
    await assertCanApproveRequest(actor.id, requestId);

    const result = await prisma.$transaction(async (tx) => {
      return applyApprovalDecision(tx, {
        requestId,
        status,
        approvalComment,
        actorId: actor.id,
        existingRequest,
      });
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    try {
      await enqueuePtoNotifications({
        eventType:
          status === "APPROVED" ? "PTO_REQUEST_APPROVED" : "PTO_REQUEST_DENIED",
        requestId,
        actorId: actor.id,
      });
    } catch (error) {
      console.error("Failed to enqueue PTO decision notifications:", error);
    }

    if (status === "APPROVED") {
      // CALENDAR SYNC
      // Outlook event creation is intentionally post-commit so a Graph failure
      // cannot undo an already-approved request.
      dispatchCalendarSyncInBackground(async () => {
        await createApprovedPtoCalendarEvent({ requestId });
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json(
        { error: "Approval has already been posted to the PTO ledger." },
        { status: 409 }
      );
    }

    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof Error && (
      error.message === "Approval has already been posted to the PTO ledger." ||
      error.message === "Only pending requests can be processed." ||
      error.message === "PTO request not found."
    )) {
      return NextResponse.json(
        { error: error.message },
        { status: error.message === "PTO request not found." ? 404 : 409 }
      );
    }

    console.error("Failed to process approval:", error);

    return NextResponse.json(
      { error: "Failed to process approval." },
      { status: 500 }
    );
  }
}

import { Prisma } from "@prisma/client";

import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";
import { applyApprovalDecision } from "../../../lib/pto/apply-approval-decision";
import {
  assertCanApproveRequest,
  isAuthorizationError,
  requireActor,
} from "../../../lib/server/authorization";
import { dispatchEmailInBackground } from "../../../lib/notifications/email/dispatch";
import {
  sendPtoRequestApprovedNotification,
  sendPtoRequestDeniedNotification,
} from "../../../lib/notifications/email/workflows";

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

    dispatchEmailInBackground(async () => {
      if (status === "APPROVED") {
        await sendPtoRequestApprovedNotification({ requestId });
      } else {
        await sendPtoRequestDeniedNotification({ requestId });
      }
    });

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

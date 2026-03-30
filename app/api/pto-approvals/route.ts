import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";
import { getApprovalScope } from "../../../lib/auth/access";
import { isManagerOf } from "../../../lib/auth/permissions";

function getBucketForLeaveType(leaveType: string): "PTO" | "COMP" {
  if (leaveType === "COMP") {
    return "COMP";
  }

  return "PTO";
}

export async function POST(request: Request) {
  try {
    const approvalAccess = await getApprovalScope();

    if (!approvalAccess.allowed) {
      return NextResponse.json(
        { error: "You do not have permission to approve requests." },
        { status: 403 }
      );
    }

    const body = await request.json();
    { error: "APPROVAL ROUTE HIT WITH BAD PAYLOAD" }

    const requestId = String(body.requestId || "").trim();
    const status = String(body.status || "").trim();
    const approvalComment = body.approvalComment
      ? String(body.approvalComment).trim()
      : null;

    if (!requestId || !["APPROVED", "DENIED"].includes(status)) {
      return NextResponse.json(
        { error: "Invalid approval payload." },
        { status: 400 }
      );
    }

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

    if (approvalAccess.scope === "DIRECT_REPORTS") {
      const isAuthorized = await isManagerOf(
        approvalAccess.user.id,
        existingRequest.employeeId
      );

      if (!isAuthorized) {
        return NextResponse.json(
          { error: "You can only approve requests for your direct reports." },
          { status: 403 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.pTORequest.update({
        where: { id: requestId },
        data: {
          status,
          approvalComment,
          decisionAt: new Date(),
          decidedBy: approvalAccess.user.id,
        },
      });

      await tx.pTORequestAction.create({
        data: {
          requestId: updatedRequest.id,
          action: status,
          actionById: approvalAccess.user.id,
          comment: approvalComment,
        },
      });

      if (status === "APPROVED") {
        const bucket = getBucketForLeaveType(existingRequest.leaveType);

        const latestLedger = await tx.pTOLedger.findFirst({
          where: {
            employeeId: existingRequest.employeeId,
            bucket,
          },
          orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
        });

        const currentBalance = latestLedger?.balance ?? 0;
        const newBalance = currentBalance - existingRequest.hours;

        const ledgerEntry = await tx.pTOLedger.create({
          data: {
            employeeId: existingRequest.employeeId,
            bucket,
            type: "USAGE",
            hours: -existingRequest.hours,
            balance: newBalance,
            effectiveDate: new Date(),
            notes: `Approved ${existingRequest.leaveType} request ${existingRequest.id}${
              approvalComment ? ` - ${approvalComment}` : ""
            }`,
          },
        });

        await tx.auditLog.create({
          data: {
            userId: approvalAccess.user.id,
            action: "REQUEST_APPROVED",
            entityType: "PTORequest",
            entityId: updatedRequest.id,
            oldValue: JSON.stringify({
              status: existingRequest.status,
              approvalComment: existingRequest.approvalComment,
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
          userId: approvalAccess.user.id,
          action: "REQUEST_DENIED",
          entityType: "PTORequest",
          entityId: updatedRequest.id,
          oldValue: JSON.stringify({
            status: existingRequest.status,
            approvalComment: existingRequest.approvalComment,
          }),
          newValue: JSON.stringify({
            status: updatedRequest.status,
            approvalComment: updatedRequest.approvalComment,
          }),
        },
      });

      return updatedRequest;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to process approval:", error);

    return NextResponse.json(
      { error: "Failed to process approval." },
      { status: 500 }
    );
  }
}
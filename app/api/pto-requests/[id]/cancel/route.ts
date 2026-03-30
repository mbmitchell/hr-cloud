import { prisma } from "../../../../../lib/db";
import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../../../lib/auth/current-user";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "You must be logged in." },
        { status: 401 }
      );
    }

    const { id } = await context.params;
    const requestId = String(id || "").trim();
    const currentEmployeeId = String(currentUser.id || "").trim();

    if (!requestId) {
      return NextResponse.json(
        { error: "Request ID is required." },
        { status: 400 }
      );
    }

    if (!currentEmployeeId) {
      return NextResponse.json(
        { error: "No employee record is linked to your account." },
        { status: 403 }
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
        { error: "Only pending requests can be cancelled." },
        { status: 400 }
      );
    }

    if (existingRequest.employeeId !== currentEmployeeId) {
      return NextResponse.json(
        { error: "You can only cancel your own requests." },
        { status: 403 }
      );
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedRequest = await tx.pTORequest.update({
        where: { id: requestId },
        data: {
          status: "CANCELLED",
          decisionAt: new Date(),
          decidedBy: currentEmployeeId,
          approvalComment: "Cancelled by employee",
        },
      });

      await tx.pTORequestAction.create({
        data: {
          requestId: updatedRequest.id,
          action: "CANCELLED",
          actionById: currentEmployeeId,
          comment: "Cancelled by employee",
        },
      });

      await tx.auditLog.create({
        data: {
          userId: currentEmployeeId,
          action: "REQUEST_CANCELLED",
          entityType: "PTORequest",
          entityId: updatedRequest.id,
          oldValue: JSON.stringify({
            status: existingRequest.status,
          }),
          newValue: JSON.stringify({
            status: updatedRequest.status,
          }),
        },
      });

      return updatedRequest;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error("Failed to cancel PTO request:", error);

    return NextResponse.json(
      { error: "Failed to cancel PTO request." },
      { status: 500 }
    );
  }
}
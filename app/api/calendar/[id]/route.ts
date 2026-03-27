import { prisma } from "../../../../lib/db";
import { NextResponse } from "next/server";
import { getApprovalScope } from "../../../../lib/auth/access";
import { isManagerOf } from "../../../../lib/auth/permissions";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const requestRecord = await prisma.pTORequest.findUnique({
      where: { id },
      include: {
        employee: true,
      },
    });

    if (!requestRecord) {
      return NextResponse.json(
        { error: "Calendar event not found." },
        { status: 404 }
      );
    }

    const approvalAccess = await getApprovalScope();

    let canAct = false;

    if (approvalAccess.allowed) {
      if (approvalAccess.scope === "ALL") {
        canAct = true;
      } else if (approvalAccess.scope === "DIRECT_REPORTS") {
        canAct = await isManagerOf(
          approvalAccess.user.id,
          requestRecord.employeeId
        );
      }
    }

    return NextResponse.json({
      id: requestRecord.id,
      employeeId: requestRecord.employeeId,
      employeeName: `${requestRecord.employee.firstName} ${requestRecord.employee.lastName}`,
      leaveType: requestRecord.leaveType,
      startDate: requestRecord.startDate.toISOString(),
      endDate: requestRecord.endDate.toISOString(),
      hours: requestRecord.hours,
      status: requestRecord.status,
      notes: requestRecord.notes ?? "",
      approvalComment: requestRecord.approvalComment ?? "",
      canAct,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load calendar event." },
      { status: 500 }
    );
  }
}
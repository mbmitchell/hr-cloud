import { prisma } from "../../../../lib/db";
import { dateToDateOnlyString } from "../../../../lib/date-only";
import { NextResponse } from "next/server";
import { getApprovalScope } from "../../../../lib/auth/access";
import { isManagerOf } from "../../../../lib/auth/permissions";
import {
  assertCanViewEmployee,
  isAuthorizationError,
  requireActor,
} from "../../../../lib/server/authorization";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
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

    await assertCanViewEmployee(actor.id, requestRecord.employeeId);

    const approvalAccess = await getApprovalScope();

    let canManage = false;

    if (approvalAccess.allowed) {
      if (approvalAccess.scope === "ALL") {
        canManage = true;
      } else if (approvalAccess.scope === "DIRECT_REPORTS") {
        canManage = await isManagerOf(
          approvalAccess.user.id,
          requestRecord.employeeId
        );
      }
    }

    const canSelfCancel =
      actor.id === requestRecord.employeeId && requestRecord.status === "PENDING";

    return NextResponse.json({
      id: requestRecord.id,
      employeeId: requestRecord.employeeId,
      employeeName: `${requestRecord.employee.firstName} ${requestRecord.employee.lastName}`,
      leaveType: requestRecord.leaveType,
      startDate: dateToDateOnlyString(requestRecord.startDate),
      endDate: dateToDateOnlyString(requestRecord.endDate),
      hours: requestRecord.hours,
      status: requestRecord.status,
      notes: requestRecord.notes ?? "",
      approvalComment: requestRecord.approvalComment ?? "",
      canAct: canManage && requestRecord.status === "PENDING",
      canManage,
      canSelfCancel,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load calendar event." },
      { status: 500 }
    );
  }
}

import { prisma } from "../../../lib/db";
import { dateToDateOnlyString } from "../../../lib/date-only";
import ApprovalsClient from "./ui";
import { getApprovalScope, getDirectReportIds } from "../../../lib/auth/access";

export default async function PTOApprovalsPage() {
  const approvalAccess = await getApprovalScope();

  if (!approvalAccess.allowed) {
    return (
      <div className="text-red-600">
        You do not have permission to approve requests.
      </div>
    );
  }

  let whereClause:
    | {
        status: "PENDING";
        employeeId?: { in: string[] };
      }
    | undefined;

  if (approvalAccess.scope === "ALL") {
    whereClause = {
      status: "PENDING",
    };
  } else {
    const directReportIds = await getDirectReportIds(approvalAccess.user.id);

    whereClause = {
      status: "PENDING",
      employeeId: {
        in: directReportIds.length ? directReportIds : ["__none__"],
      },
    };
  }

  const requests = await prisma.pTORequest.findMany({
    where: whereClause,
    include: {
      employee: true,
    },
    orderBy: {
      createdAt: "asc",
    },
  });

  const serialized = requests.map((request) => ({
    id: request.id,
    employeeId: request.employeeId,
    employeeName: `${request.employee.firstName} ${request.employee.lastName}`,
    leaveType: request.leaveType,
    startDate: dateToDateOnlyString(request.startDate),
    endDate: dateToDateOnlyString(request.endDate),
    hours: request.hours,
    status: request.status,
    notes: request.notes ?? "",
  }));

  return <ApprovalsClient requests={serialized} />;
}

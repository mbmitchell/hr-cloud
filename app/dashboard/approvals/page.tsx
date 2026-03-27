import { prisma } from "../../../lib/db";
import { getApprovalScope, getDirectReportIds } from "../../../lib/auth/access";
import { projectPtoBalance } from "../../../lib/pto/accrual";
import ManagerApprovalsClient from "./ManagerApprovalsClient";

export default async function ManagerApprovalsPage() {
  const approvalAccess = await getApprovalScope();

  if (!approvalAccess.allowed) {
    return (
      <div className="text-red-600">
        You do not have permission to view approvals.
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
      employee: {
        include: {
          manager: true,
          ledger: {
            orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
          },
          requests: {
            orderBy: [{ createdAt: "desc" }],
            take: 5,
          },
        },
      },
    },
    orderBy: [{ createdAt: "asc" }],
  });

  const rows = await Promise.all(
    requests.map(async (request) => {
      const employee = request.employee;

      const currentPtoBalance =
        employee.ledger.find((entry) => entry.bucket === "PTO")?.balance ?? 0;

      const currentCompBalance =
        employee.ledger.find((entry) => entry.bucket === "COMP")?.balance ?? 0;

      const ptoProjection = projectPtoBalance({
        currentBalance: currentPtoBalance,
        hireDate: employee.hireDate,
        requestStartDate: request.startDate,
        monthlyAccrualOverride: employee.monthlyAccrualOverride,
      });

      const effectiveAvailableBalance =
        request.leaveType === "COMP"
          ? currentCompBalance
          : ptoProjection.projectedBalance;

      const staffingConflicts = await prisma.pTORequest.findMany({
        where: {
          employee: {
            department: employee.department ?? undefined,
          },
          employeeId: {
            not: employee.id,
          },
          id: {
            not: request.id,
          },
          status: {
            in: ["APPROVED", "PENDING"],
          },
          startDate: {
            lte: request.endDate,
          },
          endDate: {
            gte: request.startDate,
          },
        },
        include: {
          employee: true,
        },
        orderBy: [{ startDate: "asc" }, { createdAt: "asc" }],
      });

      return {
        id: request.id,
        employeeId: employee.id,
        employeeName: `${employee.firstName} ${employee.lastName}`,
        department: employee.department,
        managerName: employee.manager
          ? `${employee.manager.firstName} ${employee.manager.lastName}`
          : null,
        leaveType: request.leaveType,
        startDate: request.startDate.toISOString(),
        endDate: request.endDate.toISOString(),
        hours: request.hours,
        status: request.status,
        requestNotes: request.notes ?? "",
        currentPtoBalance,
        currentCompBalance,
        projectedPtoBalance: ptoProjection.projectedBalance,
        monthlyAccrualRate: ptoProjection.monthlyRate,
        accrualCount: ptoProjection.accrualCount,
        effectiveAvailableBalance,
        staffingConflictCount: staffingConflicts.length,
        staffingConflictEmployees: staffingConflicts.map((conflict) => ({
          id: conflict.id,
          employeeName: `${conflict.employee.firstName} ${conflict.employee.lastName}`,
          leaveType: conflict.leaveType,
          status: conflict.status,
          startDate: conflict.startDate.toISOString(),
          endDate: conflict.endDate.toISOString(),
        })),
        recentRequests: employee.requests.map((r) => ({
          id: r.id,
          leaveType: r.leaveType,
          startDate: r.startDate.toISOString(),
          endDate: r.endDate.toISOString(),
          hours: r.hours,
          status: r.status,
        })),
      };
    })
  );

  return <ManagerApprovalsClient requests={rows} />;
}
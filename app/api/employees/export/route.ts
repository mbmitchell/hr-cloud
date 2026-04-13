import { prisma } from "../../../../lib/db";
import { getCurrentUser } from "../../../../lib/auth/current-user";
import { getEmployeeRoles, isManagerOf } from "../../../../lib/auth/permissions";
import { csvEscape } from "../../../../lib/server/csv";

export async function GET() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return new Response("No current user found.", { status: 401 });
  }

  const roles = await getEmployeeRoles(currentUser.id);

  const isAdmin =
    roles.includes("SITE_ADMIN") ||
    roles.includes("HR_ADMIN") ||
    roles.includes("EXECUTIVE_READONLY") ||
    roles.includes("AUDITOR");

  const isManager = roles.includes("MANAGER");

  const employees = await prisma.employee.findMany({
    include: {
      manager: true,
      ledger: {
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      },
      roleAssignments: {
        where: { isActive: true },
        include: { role: true },
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const visibleEmployees = [];

  for (const employee of employees) {
    if (isAdmin || employee.id === currentUser.id) {
      visibleEmployees.push(employee);
      continue;
    }

    if (isManager) {
      const manages = await isManagerOf(currentUser.id, employee.id);
      if (manages) {
        visibleEmployees.push(employee);
      }
    }
  }

  const header = [
    "Employee ID",
    "First Name",
    "Last Name",
    "Email",
    "Department",
    "Title",
    "Status",
    "Hire Date",
    "Manager",
    "Roles",
    "PTO Balance",
    "COMP Balance",
    "Accrual Mode",
    "Advanced Accrual Tier",
    "Advanced Accrual Effective Date",
    "Advanced Accrual Reason",
    "Monthly Accrual Override",
    "Accrual Override Reason",
  ];

  const rows = visibleEmployees.map((employee) => {
    const ptoBalance =
      employee.ledger.find((entry) => entry.bucket === "PTO")?.balance ?? 0;

    const compBalance =
      employee.ledger.find((entry) => entry.bucket === "COMP")?.balance ?? 0;

    const roles = employee.roleAssignments.map((assignment) => assignment.role.code).join("; ");

    return [
      employee.id,
      employee.firstName,
      employee.lastName,
      employee.email,
      employee.department ?? "",
      employee.title ?? "",
      employee.status,
      employee.hireDate.toISOString().split("T")[0],
      employee.manager
        ? `${employee.manager.firstName} ${employee.manager.lastName}`
        : "",
      roles,
      ptoBalance.toFixed(2),
      compBalance.toFixed(2),
      employee.accrualMode,
      employee.advancedAccrualTier ?? "",
      employee.advancedAccrualEffectiveDate
        ? employee.advancedAccrualEffectiveDate.toISOString().split("T")[0]
        : "",
      employee.advancedAccrualReason ?? "",
      employee.monthlyAccrualOverride != null
        ? employee.monthlyAccrualOverride.toFixed(2)
        : "",
      employee.accrualOverrideReason ?? "",
    ];
  });

  const csv = [
    header.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
  ].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="employee-census.csv"',
    },
  });
}

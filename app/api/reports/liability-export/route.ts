import { prisma } from "../../../../lib/db";
import { canCurrentUserViewReports } from "../../../../lib/auth/access";
import { calculatePtoLiability } from "../../../../lib/finance/liability";

function csvEscape(value: string | number | null | undefined) {
  const stringValue = value == null ? "" : String(value);
  return `"${stringValue.replace(/"/g, '""')}"`;
}

export async function GET() {
  const allowed = await canCurrentUserViewReports();

  if (!allowed) {
    return new Response("You do not have access to liability reports.", {
      status: 403,
    });
  }

  const employees = await prisma.employee.findMany({
    include: {
      ledger: {
        orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const header = [
    "Employee ID",
    "First Name",
    "Last Name",
    "Department",
    "Title",
    "Pay Type",
    "Hourly Rate",
    "Annual Salary",
    "FTE",
    "PTO Balance Hours",
    "Effective Hourly Rate",
    "Estimated PTO Liability",
  ];

  let totalPtoHours = 0;
  let totalLiability = 0;

  const rows = employees.map((employee) => {
    const ptoBalance =
      employee.ledger.find((entry) => entry.bucket === "PTO")?.balance ?? 0;

    const { effectiveHourlyRate, liability } = calculatePtoLiability({
      ptoHours: ptoBalance,
      payType: employee.payType,
      hourlyRate: employee.hourlyRate,
      annualSalary: employee.annualSalary,
      fte: employee.fte,
    });

    totalPtoHours += ptoBalance;
    totalLiability += liability;

    return [
      employee.id,
      employee.firstName,
      employee.lastName,
      employee.department ?? "",
      employee.title ?? "",
      employee.payType ?? "",
      employee.hourlyRate != null ? employee.hourlyRate.toFixed(2) : "",
      employee.annualSalary != null ? employee.annualSalary.toFixed(2) : "",
      employee.fte != null ? employee.fte.toFixed(2) : "1.00",
      ptoBalance.toFixed(2),
      effectiveHourlyRate.toFixed(2),
      liability.toFixed(2),
    ];
  });

  const totalsRow = [
    "TOTAL",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    totalPtoHours.toFixed(2),
    "",
    totalLiability.toFixed(2),
  ];

  const csv = [
    header.map(csvEscape).join(","),
    ...rows.map((row) => row.map(csvEscape).join(",")),
    totalsRow.map(csvEscape).join(","),
  ].join("\n");

  return new Response(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="pto-liability-report.csv"',
    },
  });
}
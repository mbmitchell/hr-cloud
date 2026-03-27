import { prisma } from "../db";
import { getMonthlyAccrualRate } from "./accrual";
import { getPolicySettings } from "../policy/settings";

type RunAccrualsResult = {
  runDate: string;
  processedEmployees: number;
  skippedEmployees: number;
  createdEntries: number;
  details: Array<{
    employeeId: string;
    employeeName: string;
    status: "CREATED" | "SKIPPED";
    reason: string;
    hours?: number;
    newBalance?: number;
  }>;
};

function firstOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function accrualRunLabel(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `Monthly PTO accrual ${year}-${month}`;
}

export async function runMonthlyAccruals(
  runDateInput?: Date
): Promise<RunAccrualsResult> {
  const runDate = runDateInput ? new Date(runDateInput) : new Date();
  const effectiveDate = firstOfMonth(runDate);
  const notesLabel = accrualRunLabel(effectiveDate);
  const policy = await getPolicySettings();

  const employees = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const details: RunAccrualsResult["details"] = [];
  let createdEntries = 0;
  let skippedEmployees = 0;

  for (const employee of employees) {
    const employeeName = `${employee.firstName} ${employee.lastName}`;

    const existingAccrual = await prisma.pTOLedger.findFirst({
      where: {
        employeeId: employee.id,
        bucket: "PTO",
        type: "ACCRUAL",
        effectiveDate,
      },
    });

    if (existingAccrual) {
      skippedEmployees += 1;
      details.push({
        employeeId: employee.id,
        employeeName,
        status: "SKIPPED",
        reason: "Accrual already exists for this month.",
      });
      continue;
    }

    const latestPtoLedger = await prisma.pTOLedger.findFirst({
      where: {
        employeeId: employee.id,
        bucket: "PTO",
      },
      orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
    });

    const currentBalance = latestPtoLedger?.balance ?? 0;
    const monthlyRate = getMonthlyAccrualRate(
      {
        hireDate: employee.hireDate,
        monthlyAccrualOverride: employee.monthlyAccrualOverride,
      },
      effectiveDate,
      policy
    );

    const newBalance = Number((currentBalance + monthlyRate).toFixed(2));

    const ledgerEntry = await prisma.pTOLedger.create({
      data: {
        employeeId: employee.id,
        bucket: "PTO",
        type: "ACCRUAL",
        hours: monthlyRate,
        balance: newBalance,
        effectiveDate,
        notes:
          employee.monthlyAccrualOverride != null
            ? `${notesLabel} (override applied)`
            : notesLabel,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: "system",
        action: "MONTHLY_ACCRUAL_CREATE",
        entityType: "PTOLedger",
        entityId: ledgerEntry.id,
        oldValue: JSON.stringify({
          bucket: "PTO",
          priorBalance: currentBalance,
        }),
        newValue: JSON.stringify({
          bucket: "PTO",
          accrualHours: monthlyRate,
          newBalance,
          effectiveDate: effectiveDate.toISOString(),
        }),
      },
    });

    createdEntries += 1;
    details.push({
      employeeId: employee.id,
      employeeName,
      status: "CREATED",
      reason: "Monthly accrual posted.",
      hours: monthlyRate,
      newBalance,
    });
  }

  return {
    runDate: effectiveDate.toISOString(),
    processedEmployees: employees.length,
    skippedEmployees,
    createdEntries,
    details,
  };
}
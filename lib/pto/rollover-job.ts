import { prisma } from "../db";
import { getPolicySettings } from "../policy/settings";

type RunRolloverResult = {
  runDate: string;
  processedEmployees: number;
  createdEntries: number;
  skippedEmployees: number;
  details: Array<{
    employeeId: string;
    employeeName: string;
    status: "CREATED" | "SKIPPED";
    reason: string;
    priorBalance?: number;
    forfeitedHours?: number;
    newBalance?: number;
  }>;
};

function startOfYear(date: Date) {
  return new Date(date.getFullYear(), 0, 1);
}

function rolloverLabel(date: Date) {
  return `Year-end PTO rollover ${date.getFullYear()}`;
}

export async function runYearEndRollover(
  runDateInput?: Date
): Promise<RunRolloverResult> {
  const runDate = runDateInput ? new Date(runDateInput) : new Date();
  const effectiveDate = startOfYear(runDate);
  const notesLabel = rolloverLabel(effectiveDate);
  const policy = await getPolicySettings();

  const employees = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const details: RunRolloverResult["details"] = [];
  let createdEntries = 0;
  let skippedEmployees = 0;

  for (const employee of employees) {
    const employeeName = `${employee.firstName} ${employee.lastName}`;

    const existingRollover = await prisma.pTOLedger.findFirst({
      where: {
        employeeId: employee.id,
        bucket: "PTO",
        type: "FORFEITURE",
        effectiveDate,
      },
    });

    if (existingRollover) {
      skippedEmployees += 1;
      details.push({
        employeeId: employee.id,
        employeeName,
        status: "SKIPPED",
        reason: "Rollover already processed for this year.",
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

    if (currentBalance <= policy.rolloverCapHours) {
      skippedEmployees += 1;
      details.push({
        employeeId: employee.id,
        employeeName,
        status: "SKIPPED",
        reason: `No forfeiture required. PTO balance is ${policy.rolloverCapHours} hours or less.`,
        priorBalance: currentBalance,
        newBalance: currentBalance,
      });
      continue;
    }

    const forfeitedHours = Number((currentBalance - policy.rolloverCapHours).toFixed(2));
    const newBalance = Number((currentBalance - forfeitedHours).toFixed(2));

    const ledgerEntry = await prisma.pTOLedger.create({
      data: {
        employeeId: employee.id,
        bucket: "PTO",
        type: "FORFEITURE",
        hours: -forfeitedHours,
        balance: newBalance,
        effectiveDate,
        notes: `${notesLabel} (${policy.rolloverCapHours} hour cap applied)`,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: "system",
        action: "YEAR_END_ROLLOVER_CREATE",
        entityType: "PTOLedger",
        entityId: ledgerEntry.id,
        oldValue: JSON.stringify({
          bucket: "PTO",
          priorBalance: currentBalance,
        }),
        newValue: JSON.stringify({
          bucket: "PTO",
          forfeitedHours,
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
      reason: "Rollover cap applied.",
      priorBalance: currentBalance,
      forfeitedHours,
      newBalance,
    });
  }

  return {
    runDate: effectiveDate.toISOString(),
    processedEmployees: employees.length,
    createdEntries,
    skippedEmployees,
    details,
  };
}
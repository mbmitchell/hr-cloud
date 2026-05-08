import { Prisma } from "@prisma/client";

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

function rolloverIdempotencyKey(employeeId: string, effectiveDate: Date) {
  return `year-end-rollover:${employeeId}:${effectiveDate.toISOString()}`;
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
    const idempotencyKey = rolloverIdempotencyKey(employee.id, effectiveDate);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existingRollover = await tx.pTOLedger.findFirst({
          where: {
            OR: [
              { idempotencyKey },
              {
                employeeId: employee.id,
                bucket: "PTO",
                type: "FORFEITURE",
                effectiveDate,
              },
            ],
          },
        });

        if (existingRollover) {
          return {
            status: "SKIPPED" as const,
            reason: "Rollover already processed for this year.",
          };
        }

        const latestPtoLedger = await tx.pTOLedger.findFirst({
          where: {
            employeeId: employee.id,
            bucket: "PTO",
          },
          orderBy: [{ effectiveDate: "desc" }, { createdAt: "desc" }],
        });

        const currentBalance = latestPtoLedger?.balance ?? 0;

        if (currentBalance <= policy.rolloverCapHours) {
          return {
            status: "SKIPPED" as const,
            reason: `No forfeiture required. PTO balance is ${policy.rolloverCapHours} hours or less.`,
            priorBalance: currentBalance,
            newBalance: currentBalance,
          };
        }

        const forfeitedHours = Number((currentBalance - policy.rolloverCapHours).toFixed(2));
        const newBalance = Number((currentBalance - forfeitedHours).toFixed(2));

        const ledgerEntry = await tx.pTOLedger.create({
          data: {
            employeeId: employee.id,
            bucket: "PTO",
            type: "FORFEITURE",
            hours: -forfeitedHours,
            balance: newBalance,
            effectiveDate,
            idempotencyKey,
            notes: `${notesLabel} (${policy.rolloverCapHours} hour cap applied)`,
          },
        });

        await tx.auditLog.create({
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

        return {
          status: "CREATED" as const,
          reason: "Rollover cap applied.",
          priorBalance: currentBalance,
          forfeitedHours,
          newBalance,
        };
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      if (result.status === "SKIPPED") {
        skippedEmployees += 1;
        details.push({
          employeeId: employee.id,
          employeeName,
          status: result.status,
          reason: result.reason,
          priorBalance: result.priorBalance,
          newBalance: result.newBalance,
        });
        continue;
      }

      createdEntries += 1;
      details.push({
        employeeId: employee.id,
        employeeName,
        status: result.status,
        reason: result.reason,
        priorBalance: result.priorBalance,
        forfeitedHours: result.forfeitedHours,
        newBalance: result.newBalance,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        skippedEmployees += 1;
        details.push({
          employeeId: employee.id,
          employeeName,
          status: "SKIPPED",
          reason: "Rollover already processed for this year.",
        });
        continue;
      }

      throw error;
    }
  }

  return {
    runDate: effectiveDate.toISOString(),
    processedEmployees: employees.length,
    createdEntries,
    skippedEmployees,
    details,
  };
}

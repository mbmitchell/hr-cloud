import { Prisma } from "@prisma/client";

import { prisma } from "../db";
import { getAccrualSummary, getMonthlyAccrualRate } from "./accrual";
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

function accrualIdempotencyKey(employeeId: string, effectiveDate: Date) {
  return `monthly-accrual:${employeeId}:${effectiveDate.toISOString()}`;
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
    const idempotencyKey = accrualIdempotencyKey(employee.id, effectiveDate);

    try {
      const result = await prisma.$transaction(async (tx) => {
        const existingAccrual = await tx.pTOLedger.findFirst({
          where: {
            OR: [
              { idempotencyKey },
              {
                employeeId: employee.id,
                bucket: "PTO",
                type: "ACCRUAL",
                effectiveDate,
              },
            ],
          },
        });

        if (existingAccrual) {
          return {
            status: "SKIPPED" as const,
            reason: "Accrual already exists for this month.",
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
        const accrualSummary = getAccrualSummary(
          {
            hireDate: employee.hireDate,
            accrualMode: employee.accrualMode,
            monthlyAccrualOverride: employee.monthlyAccrualOverride,
            accrualOverrideReason: employee.accrualOverrideReason,
            advancedAccrualTier: employee.advancedAccrualTier,
            advancedAccrualEffectiveDate: employee.advancedAccrualEffectiveDate,
            advancedAccrualReason: employee.advancedAccrualReason,
          },
          effectiveDate,
          policy
        );
        const monthlyRate = getMonthlyAccrualRate(
          {
            hireDate: employee.hireDate,
            accrualMode: employee.accrualMode,
            monthlyAccrualOverride: employee.monthlyAccrualOverride,
            accrualOverrideReason: employee.accrualOverrideReason,
            advancedAccrualTier: employee.advancedAccrualTier,
            advancedAccrualEffectiveDate: employee.advancedAccrualEffectiveDate,
            advancedAccrualReason: employee.advancedAccrualReason,
          },
          effectiveDate,
          policy
        );

        const newBalance = Number((currentBalance + monthlyRate).toFixed(2));

        const ledgerEntry = await tx.pTOLedger.create({
          data: {
            employeeId: employee.id,
            bucket: "PTO",
            type: "ACCRUAL",
            hours: monthlyRate,
            balance: newBalance,
            effectiveDate,
            idempotencyKey,
            notes:
              accrualSummary.source === "MANUAL_ONLY"
                ? `${notesLabel} (manual-only accrual override applied)`
                : accrualSummary.source === "ADVANCED_TIER"
                  ? `${notesLabel} (advanced tier applied)`
                  : notesLabel,
          },
        });

        await tx.auditLog.create({
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
              accrualMode: employee.accrualMode,
              accrualSource: accrualSummary.source,
              activeTier: accrualSummary.activeTier,
            }),
          },
        });

        return {
          status: "CREATED" as const,
          reason: "Monthly accrual posted.",
          hours: monthlyRate,
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
        });
        continue;
      }

      createdEntries += 1;
      details.push({
        employeeId: employee.id,
        employeeName,
        status: result.status,
        reason: result.reason,
        hours: result.hours,
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
          reason: "Accrual already exists for this month.",
        });
        continue;
      }

      throw error;
    }
  }

  return {
    runDate: effectiveDate.toISOString(),
    processedEmployees: employees.length,
    skippedEmployees,
    createdEntries,
    details,
  };
}

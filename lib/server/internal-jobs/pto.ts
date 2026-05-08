import { runMonthlyAccruals } from "../../pto/accrual-job";
import { runYearEndRollover } from "../../pto/rollover-job";
import { runTrackedInternalJob } from "./execute";

export async function runMonthlyPtoAccrualJob(input?: {
  runKey?: string;
  runDate?: Date | null;
}) {
  return runTrackedInternalJob({
    jobName: "pto-monthly-accrual",
    runKey: input?.runKey,
    execute: async () => {
      const result = await runMonthlyAccruals(input?.runDate ?? undefined);

      return {
        result,
        recordsProcessed: result.processedEmployees,
      };
    },
  });
}

export async function runYearEndPtoRolloverJob(input?: {
  runKey?: string;
  runDate?: Date | null;
}) {
  return runTrackedInternalJob({
    jobName: "pto-year-end-rollover",
    runKey: input?.runKey,
    execute: async () => {
      const result = await runYearEndRollover(input?.runDate ?? undefined);

      return {
        result,
        recordsProcessed: result.processedEmployees,
      };
    },
  });
}

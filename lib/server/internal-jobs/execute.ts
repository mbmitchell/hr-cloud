import {
  completeScheduledJobRun,
  failScheduledJobRun,
  startScheduledJobRun,
} from "./runs";

function defaultRunKey(jobName: string) {
  return `${jobName}:${new Date().toISOString()}`;
}

export async function runTrackedInternalJob<T>(input: {
  jobName: string;
  runKey?: string;
  execute: () => Promise<{ result: T; recordsProcessed?: number | null }>;
}) {
  const runKey = input.runKey?.trim() || defaultRunKey(input.jobName);
  const { run, created } = await startScheduledJobRun({
    jobName: input.jobName,
    runKey,
  });

  if (!created) {
    return {
      deduplicated: true,
      run,
      result: null as T | null,
    };
  }

  try {
    const execution = await input.execute();
    const completedRun = await completeScheduledJobRun({
      runId: run.id,
      recordsProcessed: execution.recordsProcessed ?? null,
    });

    return {
      deduplicated: false,
      run: completedRun,
      result: execution.result,
    };
  } catch (error) {
    const failedRun = await failScheduledJobRun({
      runId: run.id,
      error,
    });

    throw Object.assign(error instanceof Error ? error : new Error("Job failed."), {
      scheduledJobRun: failedRun,
    });
  }
}

export function getScheduledJobRunErrorRun(
  error: unknown
): { id: string; jobName: string; runKey: string; status: string } | null {
  if (!error || typeof error !== "object" || !("scheduledJobRun" in error)) {
    return null;
  }

  const scheduledJobRun = (error as { scheduledJobRun?: unknown }).scheduledJobRun;

  if (!scheduledJobRun || typeof scheduledJobRun !== "object") {
    return null;
  }

  const run = scheduledJobRun as Record<string, unknown>;

  if (
    typeof run.id !== "string" ||
    typeof run.jobName !== "string" ||
    typeof run.runKey !== "string" ||
    typeof run.status !== "string"
  ) {
    return null;
  }

  return {
    id: run.id,
    jobName: run.jobName,
    runKey: run.runKey,
    status: run.status,
  };
}

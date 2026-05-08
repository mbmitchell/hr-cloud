import { Prisma } from "@prisma/client";

import { prisma } from "../../db";
import { writeAuditLog } from "../audit/write-audit-log";

const SYSTEM_INTERNAL_JOB_ACTOR_ID = "system:internal-job";

function summarizeError(error: unknown) {
  const summary =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Unknown scheduled job failure.";

  return summary.slice(0, 4000);
}

type ScheduledJobRunRecord = {
  id: string;
  jobName: string;
  runKey: string;
  startedAt: Date;
  completedAt: Date | null;
  status: "RUNNING" | "SUCCESS" | "FAILED";
  recordsProcessed: number | null;
  lastError: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function startScheduledJobRun(input: {
  jobName: string;
  runKey: string;
}) {
  const scheduledJobRunClient = prisma as typeof prisma & {
    scheduledJobRun: {
      findUnique(args: Record<string, unknown>): Promise<ScheduledJobRunRecord | null>;
      create(args: Record<string, unknown>): Promise<ScheduledJobRunRecord>;
      findUniqueOrThrow(args: Record<string, unknown>): Promise<ScheduledJobRunRecord>;
      update(args: Record<string, unknown>): Promise<ScheduledJobRunRecord>;
      findMany(args: Record<string, unknown>): Promise<ScheduledJobRunRecord[]>;
    };
  };

  const existing = await scheduledJobRunClient.scheduledJobRun.findUnique({
    where: {
      runKey: input.runKey,
    },
  });

  if (existing) {
    return {
      run: existing,
      created: false,
    };
  }

  try {
    const run = await scheduledJobRunClient.scheduledJobRun.create({
      data: {
        jobName: input.jobName,
        runKey: input.runKey,
      },
    });

    await writeAuditLog(prisma, {
      userId: SYSTEM_INTERNAL_JOB_ACTOR_ID,
      action: "SCHEDULED_JOB_RUN_STARTED",
      entityType: "ScheduledJobRun",
      entityId: run.id,
      newValue: {
        jobName: run.jobName,
        runKey: run.runKey,
        startedAt: run.startedAt.toISOString(),
        status: run.status,
      },
    });

    return {
      run,
      created: true,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const run = await scheduledJobRunClient.scheduledJobRun.findUniqueOrThrow({
        where: {
          runKey: input.runKey,
        },
      });

      return {
        run,
        created: false,
      };
    }

    throw error;
  }
}

export async function completeScheduledJobRun(input: {
  runId: string;
  recordsProcessed?: number | null;
}) {
  const run = await (
    prisma as typeof prisma & {
      scheduledJobRun: {
        update(args: Record<string, unknown>): Promise<ScheduledJobRunRecord>;
      };
    }
  ).scheduledJobRun.update({
    where: {
      id: input.runId,
    },
    data: {
      status: "SUCCESS",
      completedAt: new Date(),
      recordsProcessed:
        input.recordsProcessed === undefined ? undefined : input.recordsProcessed,
      lastError: null,
    },
  });

  await writeAuditLog(prisma, {
    userId: SYSTEM_INTERNAL_JOB_ACTOR_ID,
    action: "SCHEDULED_JOB_RUN_COMPLETED",
    entityType: "ScheduledJobRun",
    entityId: run.id,
    oldValue: {
      status: "RUNNING",
    },
    newValue: {
      jobName: run.jobName,
      runKey: run.runKey,
      completedAt: run.completedAt?.toISOString() ?? null,
      status: run.status,
      recordsProcessed: run.recordsProcessed,
    },
  });

  return run;
}

export async function failScheduledJobRun(input: {
  runId: string;
  error: unknown;
  recordsProcessed?: number | null;
}) {
  const errorSummary = summarizeError(input.error);
  const run = await (
    prisma as typeof prisma & {
      scheduledJobRun: {
        update(args: Record<string, unknown>): Promise<ScheduledJobRunRecord>;
      };
    }
  ).scheduledJobRun.update({
    where: {
      id: input.runId,
    },
    data: {
      status: "FAILED",
      completedAt: new Date(),
      recordsProcessed:
        input.recordsProcessed === undefined ? undefined : input.recordsProcessed,
      lastError: errorSummary,
    },
  });

  await writeAuditLog(prisma, {
    userId: SYSTEM_INTERNAL_JOB_ACTOR_ID,
    action: "SCHEDULED_JOB_RUN_FAILED",
    entityType: "ScheduledJobRun",
    entityId: run.id,
    oldValue: {
      status: "RUNNING",
    },
    newValue: {
      jobName: run.jobName,
      runKey: run.runKey,
      completedAt: run.completedAt?.toISOString() ?? null,
      status: run.status,
      recordsProcessed: run.recordsProcessed,
      lastError: errorSummary,
    },
  });

  return run;
}

export async function listRecentScheduledJobRuns(limit = 20) {
  return (
    prisma as typeof prisma & {
      scheduledJobRun: {
        findMany(args: Record<string, unknown>): Promise<ScheduledJobRunRecord[]>;
      };
    }
  ).scheduledJobRun.findMany({
    orderBy: [{ startedAt: "desc" }],
    take: limit,
    select: {
      id: true,
      jobName: true,
      runKey: true,
      startedAt: true,
      completedAt: true,
      status: true,
      recordsProcessed: true,
      lastError: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export function getScheduledJobRunActorId() {
  return SYSTEM_INTERNAL_JOB_ACTOR_ID;
}

export function isTerminalScheduledJobRunStatus(
  status: ScheduledJobRunRecord["status"]
) {
  return status === "SUCCESS" || status === "FAILED";
}

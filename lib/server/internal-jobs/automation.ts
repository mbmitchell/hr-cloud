import { processHrNotifications } from "../hr-notifications/processor";
import { runSystemNotificationReminderGeneration } from "../hr-notifications/reminders";
import { runHrAutomationBatch } from "../employees/job-change-automation";
import { getScheduledJobRunActorId } from "./runs";
import {
  getScheduledJobRunErrorRun,
  runTrackedInternalJob,
} from "./execute";

function toCount(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function countAutomationRecords(result: Awaited<ReturnType<typeof runHrAutomationBatch>>) {
  return (
    toCount(result.autoApply.scanned) +
    toCount(result.autoApply.applied) +
    toCount(result.autoApply.failed) +
    toCount(result.escalations.jobChanges.pendingReviewEscalations) +
    toCount(result.escalations.jobChanges.approvedOverdueEscalations) +
    toCount(result.escalations.pto.created)
  );
}

function countReminderRecords(
  result: Awaited<ReturnType<typeof runSystemNotificationReminderGeneration>>
) {
  return (
    toCount(result.jobChanges.created) +
    toCount(result.acknowledgements.created)
  );
}

function countNotificationProcessingRecords(
  result: Awaited<ReturnType<typeof processHrNotifications>>
) {
  return result.processed;
}

export async function runAutomationJob(input?: {
  actorId?: string | null;
  runKey?: string;
  now?: Date;
}) {
  const actorId = input?.actorId ?? getScheduledJobRunActorId();
  const now = input?.now ?? new Date();

  return runTrackedInternalJob({
    jobName: "automation-run",
    runKey: input?.runKey,
    execute: async () => {
      const automation = await runHrAutomationBatch({
        actorId,
        now,
      });
      const processing = await processHrNotifications();

      return {
        result: {
          automation,
          processing,
        },
        recordsProcessed:
          countAutomationRecords(automation) +
          countNotificationProcessingRecords(processing),
      };
    },
  });
}

export async function runNotificationProcessingJob(input?: {
  runKey?: string;
}) {
  return runTrackedInternalJob({
    jobName: "notifications-process",
    runKey: input?.runKey,
    execute: async () => {
      const result = await processHrNotifications();

      return {
        result,
        recordsProcessed: countNotificationProcessingRecords(result),
      };
    },
  });
}

export async function runReminderGenerationJob(input?: {
  actorId?: string | null;
  runKey?: string;
  now?: Date;
}) {
  const actorId = input?.actorId ?? getScheduledJobRunActorId();
  const now = input?.now ?? new Date();

  return runTrackedInternalJob({
    jobName: "reminders-generate",
    runKey: input?.runKey,
    execute: async () => {
      const result = await runSystemNotificationReminderGeneration({
        actorId,
        now,
      });

      return {
        result,
        recordsProcessed: countReminderRecords(result),
      };
    },
  });
}

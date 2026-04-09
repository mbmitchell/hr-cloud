import { prisma } from "../lib/db";
import {
  getDocumentAcknowledgementReminderConfig,
  runDocumentAssignmentReminderGeneration,
} from "../lib/server/document-acknowledgements/reminders";

async function main() {
  const config = getDocumentAcknowledgementReminderConfig();
  const timestamp = new Date().toISOString();

  if (!config.enabled) {
    console.info(
      JSON.stringify({
        event: "DOCUMENT_ASSIGNMENT_REMINDER_JOB_SKIPPED",
        timestamp,
        enabled: false,
        reason: "DOCUMENT_ACKNOWLEDGEMENT_REMINDERS_ENABLED is not true.",
      })
    );
    return;
  }

  const result = await runDocumentAssignmentReminderGeneration({
    staleThresholdDays: config.staleThresholdDays,
  });

  console.info(
    JSON.stringify({
      event: "DOCUMENT_ASSIGNMENT_REMINDER_JOB_COMPLETED",
      timestamp: result.timestamp,
      eligible: result.eligible,
      created: result.created,
      skippedDuplicates: result.skippedDuplicates,
      overdue: result.countsByType.overdue,
      stalePending: result.countsByType.stalePending,
      staleThresholdDays: result.staleThresholdDays,
      failures: 0,
    })
  );
}

main()
  .catch((error) => {
    console.error(
      JSON.stringify({
        event: "DOCUMENT_ASSIGNMENT_REMINDER_JOB_FAILED",
        timestamp: new Date().toISOString(),
        error:
          error instanceof Error
            ? `${error.name}: ${error.message}`
            : "Unknown reminder job failure.",
      })
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

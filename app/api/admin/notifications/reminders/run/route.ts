import { NextResponse } from "next/server";

import { withPrivateNoStoreHeaders } from "../../../../../../lib/server/http/headers";
import {
  getScheduledJobErrorResponse,
  getInternalJobRunKey,
} from "../../../../../../lib/server/internal-jobs/http";
import { runReminderGenerationJob } from "../../../../../../lib/server/internal-jobs/automation";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../../lib/server/authorization";

export async function POST(request: Request) {
  try {
    const actor = await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "HR_NOTIFICATION_REMINDER_RUN",
      entityType: "HrNotificationOutbox",
      entityId: "reminder-batch",
    });

    const result = await runReminderGenerationJob({
      actorId: actor.id,
      runKey: getInternalJobRunKey(request),
    });

    return NextResponse.json(
      { result },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return getScheduledJobErrorResponse(
      error,
      "Failed to generate reminders."
    );
  }
}

import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db";
import {
  getJobChangeAutomationConfig,
  listRecentAutoAppliedChanges,
} from "../../../../lib/server/employees/job-change-automation";
import { withPrivateNoStoreHeaders } from "../../../../lib/server/http/headers";
import { listRecentScheduledJobRuns } from "../../../../lib/server/internal-jobs/runs";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../lib/server/authorization";

export async function GET() {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "HR_NOTIFICATION_VIEW",
      entityType: "HrNotificationOutbox",
      entityId: "list",
    });

    const [notifications, recentAutoAppliedChanges, recentJobRuns] = await Promise.all([
      prisma.hrNotificationOutbox.findMany({
        orderBy: [{ createdAt: "desc" }],
        take: 250,
        select: {
          id: true,
          eventType: true,
          relatedEntityType: true,
          relatedEntityId: true,
          notificationType: true,
          recipientEmail: true,
          status: true,
          attemptCount: true,
          lastAttemptAt: true,
          sentAt: true,
          lastError: true,
          createdAt: true,
        },
      }),
      listRecentAutoAppliedChanges(),
      listRecentScheduledJobRuns(),
    ]);
    const automationConfig = getJobChangeAutomationConfig();

    return NextResponse.json(
      {
        notifications,
        automation: {
          autoApplyEnabled: automationConfig.autoApplyEnabled,
          pendingEscalationDays: automationConfig.pendingEscalationDays,
          ptoPendingEscalationHours: automationConfig.ptoPendingEscalationHours,
          recentAutoAppliedChanges,
          recentJobRuns,
        },
      },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return NextResponse.json(
      { error: "Failed to load notification status." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

import { NextResponse } from "next/server";

import { writeAuditLog } from "../../../../../../lib/server/audit/write-audit-log";
import { prisma } from "../../../../../../lib/db";
import {
  processHrNotifications,
  retryHrNotification,
} from "../../../../../../lib/server/hr-notifications/processor";
import { withPrivateNoStoreHeaders } from "../../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../../lib/server/authorization";

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "HR_NOTIFICATION_RETRY",
      entityType: "HrNotificationOutbox",
      entityId: id,
    });
    const notification = await prisma.hrNotificationOutbox.findUnique({
      where: { id },
      select: {
        id: true,
        eventType: true,
        relatedEntityType: true,
        relatedEntityId: true,
      },
    });

    if (!notification) {
      return NextResponse.json(
        { error: "Notification not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    await retryHrNotification({
      notificationId: id,
      actorId: actor.id,
    });

    await processHrNotifications({
      notificationIds: [id],
      limit: 1,
      ignoreMaxAttempts: true,
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "HR_NOTIFICATION_RETRY_TRIGGERED",
      entityType: "HrNotificationOutbox",
      entityId: id,
      newValue: {
        eventType: notification.eventType,
        relatedEntityType: notification.relatedEntityType,
        relatedEntityId: notification.relatedEntityId,
      },
    });

    return NextResponse.json(
      { ok: true },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    const message =
      error instanceof Error ? error.message : "Failed to retry notification.";

    return NextResponse.json(
      { error: message },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

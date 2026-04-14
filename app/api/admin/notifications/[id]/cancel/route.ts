import { NextResponse } from "next/server";

import { withPrivateNoStoreHeaders } from "../../../../../../lib/server/http/headers";
import { cancelHrNotification } from "../../../../../../lib/server/hr-notifications/processor";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../../lib/server/authorization";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const actor = await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "HR_NOTIFICATION_CANCEL",
      entityType: "HrNotificationOutbox",
      entityId: id,
    });
    const body = await request.json().catch(() => ({}));
    const reason = body.reason ? String(body.reason).trim() : null;

    await cancelHrNotification({
      notificationId: id,
      actorId: actor.id,
      reason,
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
      error instanceof Error ? error.message : "Failed to cancel notification.";

    return NextResponse.json(
      { error: message },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

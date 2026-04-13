import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import {
  assertCanManageDocumentAcknowledgements,
  requireDocumentAcknowledgementActor,
} from "../../../../../lib/server/document-acknowledgements/access";
import {
  getDocumentAcknowledgementReminderConfig,
  triggerDocumentAssignmentReminderEmails,
} from "../../../../../lib/server/document-acknowledgements/reminders";
import { isAuthorizationError } from "../../../../../lib/server/authorization";

export async function POST(request: Request) {
  try {
    const actor = await requireDocumentAcknowledgementActor();
    assertCanManageDocumentAcknowledgements(actor);

    const body = await request.json().catch(() => ({}));
    const config = getDocumentAcknowledgementReminderConfig();
    const rawThresholdDays = Number(
      body.staleThresholdDays ?? config.staleThresholdDays
    );
    const staleThresholdDays =
      Number.isFinite(rawThresholdDays) && rawThresholdDays >= 0
        ? Math.floor(rawThresholdDays)
        : NaN;

    if (!Number.isFinite(staleThresholdDays)) {
      return NextResponse.json(
        { error: "staleThresholdDays must be a non-negative number." },
        { status: 400 }
      );
    }

    const result = await triggerDocumentAssignmentReminderEmails({
      actor,
      staleThresholdDays,
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "DOCUMENT_ACKNOWLEDGEMENT_REMINDER_TRIGGER",
      entityType: "EmployeeDocumentAssignment",
      entityId: "manual-reminder-run",
      newValue: result,
    });

    return NextResponse.json({ result });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to trigger acknowledgement reminders." },
      { status: 500 }
    );
  }
}

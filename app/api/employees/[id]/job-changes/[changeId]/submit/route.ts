import { NextResponse } from "next/server";

import { prisma } from "../../../../../../../lib/db";
import { writeAuditLog } from "../../../../../../../lib/server/audit/write-audit-log";
import { canActorManageEmployeeChangeRequests } from "../../../../../../../lib/server/employees/change-requests";
import { auditNotificationSuppressed } from "../../../../../../../lib/server/hr-notifications/audit";
import { enqueueJobChangeNotifications } from "../../../../../../../lib/server/hr-notifications/job-changes";
import { withPrivateNoStoreHeaders } from "../../../../../../../lib/server/http/headers";
import { isAuthorizationError, requireActor } from "../../../../../../../lib/server/authorization";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  try {
    const actor = await requireActor();
    const body = await request.json().catch(() => ({}));
    const { id, changeId } = await params;
    const sendNotification =
      typeof body.sendNotification === "boolean" ? body.sendNotification : true;
    const notificationSuppressionReason = body.notificationSuppressionReason
      ? String(body.notificationSuppressionReason).trim()
      : null;

    if (!canActorManageEmployeeChangeRequests(actor)) {
      return NextResponse.json(
        { error: "You do not have permission to submit employee change requests." },
        withPrivateNoStoreHeaders({ status: 403 })
      );
    }

    const change = await (prisma as typeof prisma & {
      employeeChangeRequest: {
        findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
        update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
      };
    }).employeeChangeRequest.findUnique({
      where: { id: changeId },
    });

    if (!change || String(change.employeeId) !== id) {
      return NextResponse.json(
        { error: "Employee change request not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    if (change.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft change requests can be submitted." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    await prisma.$transaction(async (tx) => {
      await (tx as typeof tx & {
        employeeChangeRequest: {
          update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
        };
      }).employeeChangeRequest.update({
        where: { id: changeId },
        data: {
          status: "PENDING",
          submittedAt: new Date(),
        },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_CHANGE_REQUEST_SUBMIT",
        entityType: "EmployeeChangeRequest",
        entityId: changeId,
      });
    });

    if (sendNotification) {
      try {
        await enqueueJobChangeNotifications({
          eventType: "EMPLOYEE_CHANGE_REQUEST_SUBMITTED",
          changeRequestId: changeId,
          actorId: actor.id,
        });
      } catch (error) {
        console.error("Failed to enqueue submitted job change notifications:", error);
      }
    } else {
      await auditNotificationSuppressed({
        actorId: actor.id,
        eventType: "EMPLOYEE_CHANGE_REQUEST_SUBMITTED",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: changeId,
        recipientScope: "HR_ADMIN_AND_SITE_ADMIN",
        reason: notificationSuppressionReason,
      });
    }

    return NextResponse.json(
      { success: true },
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
      { error: "Failed to submit employee change request." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

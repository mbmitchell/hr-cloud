import { NextResponse } from "next/server";

import { prisma } from "../../../../../../../lib/db";
import { writeAuditLog } from "../../../../../../../lib/server/audit/write-audit-log";
import { applyApprovedEmployeeChangeRequest, canActorManageEmployeeChangeRequests } from "../../../../../../../lib/server/employees/change-requests";
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
        { error: "You do not have permission to apply employee change requests." },
        withPrivateNoStoreHeaders({ status: 403 })
      );
    }

    const change = await (prisma as typeof prisma & {
      employeeChangeRequest: {
        findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
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

    if (change.status !== "APPROVED") {
      return NextResponse.json(
        { error: "Only approved change requests can be applied." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    await prisma.$transaction(async (tx) => {
      await applyApprovedEmployeeChangeRequest(tx as typeof tx & {
        employee: {
          findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
          update(args: {
            where: { id: string };
            data: Record<string, unknown>;
          }): Promise<unknown>;
        };
        employeeChangeRequest: {
          findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
          update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
        };
        employeeStatusHistory: {
          create(args: Record<string, unknown>): Promise<unknown>;
        };
        employeeCompensationProfile: {
          upsert(args: {
            where: { employeeId: string };
            update: Record<string, unknown>;
            create: Record<string, unknown>;
          }): Promise<unknown>;
        };
      }, {
        changeId,
        appliedByEmployeeId: actor.id,
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_CHANGE_REQUEST_APPLY",
        entityType: "EmployeeChangeRequest",
        entityId: changeId,
        newValue: {
          employeeId: id,
          appliedValues: change.newValues,
        },
      });
    });

    if (sendNotification) {
      try {
        await enqueueJobChangeNotifications({
          eventType: "EMPLOYEE_CHANGE_REQUEST_APPLIED",
          changeRequestId: changeId,
          actorId: actor.id,
        });
      } catch (error) {
        console.error("Failed to enqueue applied job change notifications:", error);
      }
    } else {
      await auditNotificationSuppressed({
        actorId: actor.id,
        eventType: "EMPLOYEE_CHANGE_REQUEST_APPLIED",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: changeId,
        recipientScope: "EMPLOYEE_AND_HR_ADMIN",
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
      { error: "Failed to apply employee change request." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

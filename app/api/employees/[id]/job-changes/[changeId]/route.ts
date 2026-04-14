import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/db";
import { writeAuditLog } from "../../../../../../lib/server/audit/write-audit-log";
import {
  buildEmployeeChangeRequestSnapshots,
  canActorManageEmployeeChangeRequests,
  canActorViewEmployeeChangeRequests,
  parseEmployeeChangeRequestInput,
  serializeEmployeeChangeRequest,
} from "../../../../../../lib/server/employees/change-requests";
import { withPrivateNoStoreHeaders } from "../../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
  requireActor,
} from "../../../../../../lib/server/authorization";

function forbiddenResponse(message = "You do not have permission to access this employee change request.") {
  return NextResponse.json(
    { error: message },
    withPrivateNoStoreHeaders({ status: 403 })
  );
}

async function loadChangeRequest(changeId: string) {
  return (prisma as typeof prisma & {
    employeeChangeRequest: {
      findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    };
  }).employeeChangeRequest.findUnique({
    where: { id: changeId },
    include: {
      requestedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      reviewedBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
        },
      },
      relatedDocument: {
        select: {
          id: true,
          originalFileName: true,
          category: true,
        },
      },
    },
  });
}

async function validateRelatedDocument(employeeId: string, documentId: string | null) {
  if (!documentId) {
    return null;
  }

  return prisma.employeeDocument.findFirst({
    where: {
      id: documentId,
      employeeId,
      status: "ACTIVE",
    },
    select: { id: true },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  try {
    const actor = await requireActor();
    const { id, changeId } = await params;
    const change = await loadChangeRequest(changeId);

    if (!change || String(change.employeeId) !== id) {
      return NextResponse.json(
        { error: "Employee change request not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    if (
      !canActorViewEmployeeChangeRequests({
        actor,
        employeeId: id,
        status: change.status as "DRAFT" | "PENDING" | "APPROVED" | "APPLIED" | "CANCELLED",
      })
    ) {
      return forbiddenResponse();
    }

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "EMPLOYEE_CHANGE_REQUEST_VIEW",
      entityType: "EmployeeChangeRequest",
      entityId: String(change.id),
      newValue: {
        employeeId: id,
        status: change.status,
      },
    });

    return NextResponse.json(
      {
        change: serializeEmployeeChangeRequest(
          change as Parameters<typeof serializeEmployeeChangeRequest>[0]
        ),
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
      { error: "Failed to load employee change request." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; changeId: string }> }
) {
  try {
    const actor = await requireActor();
    const { id, changeId } = await params;

    if (!canActorManageEmployeeChangeRequests(actor)) {
      return forbiddenResponse("You do not have permission to update employee change requests.");
    }

    const [change, employee] = await Promise.all([
      loadChangeRequest(changeId),
      (prisma.employee as any).findUnique({
        where: { id },
        include: {
          compensationProfile: true,
        },
      }),
    ]);

    if (!change || String(change.employeeId) !== id) {
      return NextResponse.json(
        { error: "Employee change request not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    if (change.status !== "DRAFT") {
      return NextResponse.json(
        { error: "Only draft change requests can be edited." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    let parsed;

    try {
      parsed = parseEmployeeChangeRequestInput(body);
    } catch (error) {
      return NextResponse.json(
        {
          error:
            error instanceof Error
              ? error.message
              : "Employee change request is invalid.",
        },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    if (parsed.newValues.managerId) {
      if (parsed.newValues.managerId === id) {
        return NextResponse.json(
          { error: "An employee cannot be their own manager." },
          withPrivateNoStoreHeaders({ status: 400 })
        );
      }

      const manager = await prisma.employee.findUnique({
        where: { id: parsed.newValues.managerId },
        select: { id: true },
      });

      if (!manager) {
        return NextResponse.json(
          { error: "Selected manager was not found." },
          withPrivateNoStoreHeaders({ status: 400 })
        );
      }
    }

    const relatedDocument = await validateRelatedDocument(id, parsed.relatedDocumentId);

    if (parsed.relatedDocumentId && !relatedDocument) {
      return NextResponse.json(
        { error: "Supporting document was not found for this employee." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const snapshots = buildEmployeeChangeRequestSnapshots(employee, parsed.newValues);

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await (tx as typeof tx & {
        employeeChangeRequest: {
          update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
        };
      }).employeeChangeRequest.update({
        where: { id: changeId },
        data: {
          changeType: parsed.changeType,
          requestedEffectiveDate: parsed.requestedEffectiveDate,
          reason: parsed.reason,
          notes: parsed.notes,
          relatedDocumentId: parsed.relatedDocumentId,
          oldValues: snapshots.oldValues,
          newValues: snapshots.newValues,
        },
        include: {
          requestedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          reviewedBy: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          relatedDocument: {
            select: {
              id: true,
              originalFileName: true,
              category: true,
            },
          },
        },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_CHANGE_REQUEST_UPDATE",
        entityType: "EmployeeChangeRequest",
        entityId: String(saved.id),
        oldValue: {
          changeType: change.changeType,
          requestedEffectiveDate: change.requestedEffectiveDate,
          reason: change.reason,
          notes: change.notes,
          oldValues: change.oldValues,
          newValues: change.newValues,
        },
        newValue: {
          changeType: parsed.changeType,
          requestedEffectiveDate: parsed.requestedEffectiveDate.toISOString().split("T")[0],
          reason: parsed.reason,
          notes: parsed.notes,
          oldValues: snapshots.oldValues,
          newValues: snapshots.newValues,
        },
      });

      return saved;
    });

    return NextResponse.json(
      {
        success: true,
        change: serializeEmployeeChangeRequest(
          updated as Parameters<typeof serializeEmployeeChangeRequest>[0]
        ),
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
      { error: "Failed to update employee change request." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

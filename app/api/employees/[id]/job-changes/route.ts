import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import {
  buildEmployeeChangeRequestSnapshots,
  canActorManageEmployeeChangeRequests,
  canActorViewEmployeeChangeRequests,
  parseEmployeeChangeRequestInput,
  serializeEmployeeChangeRequest,
} from "../../../../../lib/server/employees/change-requests";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
  requireActor,
} from "../../../../../lib/server/authorization";

function forbiddenResponse(message = "You do not have permission to manage employee change requests.") {
  return NextResponse.json(
    { error: message },
    withPrivateNoStoreHeaders({ status: 403 })
  );
}

async function validateRelatedDocument(employeeId: string, documentId: string | null) {
  if (!documentId) {
    return null;
  }

  const document = await prisma.employeeDocument.findFirst({
    where: {
      id: documentId,
      employeeId,
      status: "ACTIVE",
    },
    select: {
      id: true,
    },
  });

  return document;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    if (
      !canActorViewEmployeeChangeRequests({
        actor,
        employeeId: id,
        status: actor.id === id ? "APPLIED" : undefined,
      })
    ) {
      return forbiddenResponse("You do not have permission to view employee change history.");
    }

    const changes = await (prisma as typeof prisma & {
      employeeChangeRequest: {
        findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
      };
    }).employeeChangeRequest.findMany({
      where: {
        employeeId: id,
        ...(canActorManageEmployeeChangeRequests(actor) ? {} : { status: "APPLIED" }),
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
      orderBy: [{ requestedEffectiveDate: "desc" }, { createdAt: "desc" }],
    });

    return NextResponse.json(
      {
        changes: changes.map((change) =>
          serializeEmployeeChangeRequest(change as Parameters<typeof serializeEmployeeChangeRequest>[0])
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
      { error: "Failed to load employee change history." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    if (!canActorManageEmployeeChangeRequests(actor)) {
      return forbiddenResponse();
    }

    const employee = await (prisma.employee as any).findUnique({
      where: { id },
      include: {
        compensationProfile: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
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

    const saved = await prisma.$transaction(async (tx) => {
      const change = await (tx as typeof tx & {
        employeeChangeRequest: {
          create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
        };
      }).employeeChangeRequest.create({
        data: {
          employeeId: id,
          status: "DRAFT",
          changeType: parsed.changeType,
          requestedByEmployeeId: actor.id,
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
        action: "EMPLOYEE_CHANGE_REQUEST_DRAFT_CREATE",
        entityType: "EmployeeChangeRequest",
        entityId: String(change.id),
        newValue: {
          employeeId: id,
          changeType: parsed.changeType,
          requestedEffectiveDate: parsed.requestedEffectiveDate.toISOString().split("T")[0],
          newValues: snapshots.newValues,
        },
      });

      return change;
    });

    return NextResponse.json(
      {
        success: true,
        change: serializeEmployeeChangeRequest(
          saved as Parameters<typeof serializeEmployeeChangeRequest>[0]
        ),
      },
      withPrivateNoStoreHeaders({ status: 201 })
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return NextResponse.json(
      { error: "Failed to create employee change request." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/db";
import { requireActor, isAuthorizationError } from "../../../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../../lib/server/http/headers";
import {
  assertCanManagePrivateEmployeeInfo,
  parseEmployeeEmergencyContactInput,
  serializeEmployeeEmergencyContact,
} from "../../../../../../lib/server/employees/private-contact-info";

function forbiddenResponse() {
  return NextResponse.json(
    { error: "You do not have permission to manage private employee information." },
    withPrivateNoStoreHeaders({ status: 403 })
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const actor = await requireActor();
    const { id, contactId } = await params;

    try {
      assertCanManagePrivateEmployeeInfo(actor, id);
    } catch {
      return forbiddenResponse();
    }

    const existing = await prisma.employeeEmergencyContact.findUnique({
      where: { id: contactId },
    });

    if (!existing || existing.employeeId !== id) {
      return NextResponse.json(
        { error: "Emergency contact not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    const body = (await request.json()) as Record<string, unknown>;
    let parsed;

    try {
      parsed = parseEmployeeEmergencyContactInput(body);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid emergency contact." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.employeeEmergencyContact.update({
        where: { id: contactId },
        data: parsed,
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_EMERGENCY_CONTACT_UPDATE",
        entityType: "EmployeeEmergencyContact",
        entityId: saved.id,
        oldValue: serializeEmployeeEmergencyContact(existing),
        newValue: serializeEmployeeEmergencyContact(saved),
      });

      return saved;
    });

    return NextResponse.json(
      { success: true, contact: serializeEmployeeEmergencyContact(updated) },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    console.error("Emergency contact update failed:", error);

    return NextResponse.json(
      { error: "Failed to update emergency contact." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; contactId: string }> }
) {
  try {
    const actor = await requireActor();
    const { id, contactId } = await params;

    try {
      assertCanManagePrivateEmployeeInfo(actor, id);
    } catch {
      return forbiddenResponse();
    }

    const existing = await prisma.employeeEmergencyContact.findUnique({
      where: { id: contactId },
    });

    if (!existing || existing.employeeId !== id) {
      return NextResponse.json(
        { error: "Emergency contact not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.employeeEmergencyContact.delete({
        where: { id: contactId },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_EMERGENCY_CONTACT_DELETE",
        entityType: "EmployeeEmergencyContact",
        entityId: existing.id,
        oldValue: serializeEmployeeEmergencyContact(existing),
      });
    });

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

    console.error("Emergency contact delete failed:", error);

    return NextResponse.json(
      { error: "Failed to delete emergency contact." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

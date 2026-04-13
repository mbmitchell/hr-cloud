import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import { requireActor, isAuthorizationError } from "../../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  assertCanManagePrivateEmployeeInfo,
  parseEmployeeEmergencyContactInput,
  serializeEmployeeEmergencyContact,
} from "../../../../../lib/server/employees/private-contact-info";

function forbiddenResponse() {
  return NextResponse.json(
    { error: "You do not have permission to manage private employee information." },
    withPrivateNoStoreHeaders({ status: 403 })
  );
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireActor();
    const { id } = await params;

    try {
      assertCanManagePrivateEmployeeInfo(actor, id);
    } catch {
      return forbiddenResponse();
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    const contacts = await prisma.employeeEmergencyContact.findMany({
      where: { employeeId: id },
      orderBy: [{ priority: "asc" }, { createdAt: "asc" }],
    });

    return NextResponse.json(
      { contacts: contacts.map(serializeEmployeeEmergencyContact) },
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
      { error: "Failed to load emergency contacts." },
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

    try {
      assertCanManagePrivateEmployeeInfo(actor, id);
    } catch {
      return forbiddenResponse();
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: { id: true },
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
      parsed = parseEmployeeEmergencyContactInput(body);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid emergency contact." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const saved = await prisma.$transaction(async (tx) => {
      const contact = await tx.employeeEmergencyContact.create({
        data: {
          employeeId: id,
          ...parsed,
        },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_EMERGENCY_CONTACT_CREATE",
        entityType: "EmployeeEmergencyContact",
        entityId: contact.id,
        newValue: serializeEmployeeEmergencyContact(contact),
      });

      return contact;
    });

    return NextResponse.json(
      {
        success: true,
        contact: serializeEmployeeEmergencyContact(saved),
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

    console.error("Emergency contact create failed:", error);

    return NextResponse.json(
      { error: "Failed to save emergency contact." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

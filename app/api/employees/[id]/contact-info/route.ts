import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import { requireActor, isAuthorizationError } from "../../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  assertCanManagePrivateEmployeeInfo,
  parseEmployeeContactInfoInput,
  serializeEmployeeContactInfo,
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
      select: {
        id: true,
        contactInfo: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    return NextResponse.json(
      {
        contactInfo: serializeEmployeeContactInfo(employee.contactInfo),
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
      { error: "Failed to load employee contact information." },
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
      select: {
        id: true,
        contactInfo: true,
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
      parsed = parseEmployeeContactInfoInput(body);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Invalid contact information." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const saved = await prisma.$transaction(async (tx) => {
      const nextValue = await tx.employeeContactInfo.upsert({
        where: { employeeId: id },
        update: parsed,
        create: {
          employeeId: id,
          ...parsed,
        },
      });

      await writeAuditLog(tx, {
        userId: actor.id,
        action: "EMPLOYEE_CONTACT_INFO_UPDATE",
        entityType: "EmployeeContactInfo",
        entityId: nextValue.id,
        oldValue: serializeEmployeeContactInfo(employee.contactInfo),
        newValue: serializeEmployeeContactInfo(nextValue),
      });

      return nextValue;
    });

    return NextResponse.json(
      {
        success: true,
        contactInfo: serializeEmployeeContactInfo(saved),
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

    console.error("Employee contact info update failed:", error);

    return NextResponse.json(
      { error: "Failed to save employee contact information." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

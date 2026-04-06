import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../lib/server/authorization";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    await requireRole(["SITE_ADMIN", "HR_ADMIN", "ACCOUNTING"], {
      attemptedAction: "COMPENSATION_VIEW",
      entityType: "Employee",
      entityId: id,
    });

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        payType: true,
        hourlyRate: true,
        annualSalary: true,
        fte: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load compensation." },
      { status: 500 }
    );
  }
}

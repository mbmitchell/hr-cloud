import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import { serializeCompensationProfile } from "../../../../../lib/server/employees/compensation";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
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

    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "COMPENSATION_VIEW",
      entityType: "Employee",
      entityId: id,
    });

    const employee = await (prisma.employee as any).findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        payType: true,
        hourlyRate: true,
        annualSalary: true,
        fte: true,
        payrollFrequency: true,
        hireDate: true,
        compensationProfile: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    return NextResponse.json(
      serializeCompensationProfile(employee),
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
      { error: "Failed to load compensation." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

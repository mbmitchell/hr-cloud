import { NextResponse } from "next/server";

import { getEmployeeLinkedIdentityDetails } from "../../../../../../lib/server/auth/identity-linkage";
import { withPrivateNoStoreHeaders } from "../../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../../lib/server/authorization";

type RouteContext = {
  params: Promise<{
    employeeId: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "AUTH_IDENTITY_LINKAGE_EMPLOYEE_VIEW",
      entityType: "AuthIdentityLinkage",
      entityId: "employee",
    });

    const { employeeId } = await context.params;
    const details = await getEmployeeLinkedIdentityDetails(employeeId);

    if (!details) {
      return NextResponse.json(
        { error: "Employee not found." },
        withPrivateNoStoreHeaders({ status: 404 })
      );
    }

    return NextResponse.json(
      { details },
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
      { error: "Failed to load linked identity details." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

import { NextResponse } from "next/server";

import { requireRoleWithTenantContext } from "../../../../../lib/server/tenant-context-route";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
} from "../../../../../lib/server/authorization";
import { getEmployeeDirectoryTenantShadowCompare } from "../../../../../lib/server/employees/employee-queries";

export async function GET() {
  try {
    const { actor, tenantContext } = await requireRoleWithTenantContext(
      ["SITE_ADMIN", "HR_ADMIN"],
      {
        attemptedAction: "EMPLOYEE_DIRECTORY_TENANT_SHADOW_VIEW",
        entityType: "EmployeeDirectoryTenantShadow",
        entityId: "employee-directory",
      }
    );

    const shadowCompare = await getEmployeeDirectoryTenantShadowCompare({
      actorId: actor.id,
      tenantContext,
    });

    return NextResponse.json(
      {
        mode: "shadow_compare",
        shadowCompare,
        tenantContext,
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
      { error: "Failed to load employee directory tenant shadow compare." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

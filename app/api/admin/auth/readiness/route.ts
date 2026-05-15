import { NextResponse } from "next/server";

import { getUnifiedIdentityOrganizationReadinessSummary } from "../../../../../lib/server/auth/identity-linkage";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
} from "../../../../../lib/server/authorization";
import { requireRoleWithTenantContext } from "../../../../../lib/server/tenant-context-route";

export async function GET() {
  try {
    const { tenantContext } = await requireRoleWithTenantContext(
      ["SITE_ADMIN", "HR_ADMIN"],
      {
      attemptedAction: "AUTH_READINESS_VIEW",
      entityType: "AuthReadiness",
      entityId: "identity-organization-readiness",
      }
    );

    const readiness = await getUnifiedIdentityOrganizationReadinessSummary();

    return NextResponse.json(
      {
        readiness,
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
      { error: "Failed to load identity and organization readiness." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

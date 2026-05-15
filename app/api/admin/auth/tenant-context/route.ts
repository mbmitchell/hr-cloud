import { NextResponse } from "next/server";

import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
} from "../../../../../lib/server/authorization";
import { requireAdminWithTenantContext } from "../../../../../lib/server/tenant-context-route";

export async function GET() {
  try {
    const { tenantContext } = await requireAdminWithTenantContext({
      attemptedAction: "TENANT_CONTEXT_VIEW",
      entityType: "TenantContext",
      entityId: "current-admin",
    });

    return NextResponse.json(
      {
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
      { error: "Failed to resolve tenant context." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

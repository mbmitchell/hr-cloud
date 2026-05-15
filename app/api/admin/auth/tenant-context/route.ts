import { NextResponse } from "next/server";

import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../lib/server/authorization";
import { resolveTenantContext } from "../../../../../lib/server/tenant-context";

export async function GET() {
  try {
    await requireAdmin({
      attemptedAction: "TENANT_CONTEXT_VIEW",
      entityType: "TenantContext",
      entityId: "current-admin",
    });

    const tenantContext = await resolveTenantContext();

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

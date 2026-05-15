import { NextResponse } from "next/server";

import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../lib/server/authorization";
import {
  backfillIdentityLinkage,
} from "../../../../../lib/server/auth/identity-linkage";
import { getIdentityLinkageCoverageSummaryForTenantContext } from "../../../../../lib/server/auth/identity-linkage-readonly-repository";
import { requireRoleWithTenantContext } from "../../../../../lib/server/tenant-context-route";

export async function GET() {
  try {
    const { tenantContext } = await requireRoleWithTenantContext(
      ["SITE_ADMIN", "HR_ADMIN"],
      {
        attemptedAction: "AUTH_IDENTITY_LINKAGE_VIEW",
        entityType: "AuthIdentityLinkage",
        entityId: "coverage",
      }
    );

    const coverage = await getIdentityLinkageCoverageSummaryForTenantContext(
      tenantContext
    );

    return NextResponse.json(
      {
        mode: "preview",
        coverage,
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
      { error: "Failed to load identity linkage coverage." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "AUTH_IDENTITY_LINKAGE_BACKFILL",
      entityType: "AuthIdentityLinkage",
      entityId: "backfill",
    });

    const body = await request.json().catch(() => ({}));
    const apply = body?.apply === true;
    const result = await backfillIdentityLinkage({
      actorId: actor.id,
      apply,
    });

    return NextResponse.json(
      {
        mode: apply ? "apply" : "preview",
        result,
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
      { error: "Failed to run identity linkage backfill." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

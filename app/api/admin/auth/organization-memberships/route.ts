import { NextResponse } from "next/server";

import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../../lib/server/authorization";
import {
  backfillOrganizationMemberships,
} from "../../../../../lib/server/auth/organization-membership-backfill";
import { previewOrganizationMembershipBackfillForTenantContext } from "../../../../../lib/server/auth/organization-membership-readonly-repository";
import { requireRoleWithTenantContext } from "../../../../../lib/server/tenant-context-route";

export async function GET() {
  try {
    const { tenantContext } = await requireRoleWithTenantContext(
      ["SITE_ADMIN", "HR_ADMIN"],
      {
        attemptedAction: "ORGANIZATION_MEMBERSHIP_BACKFILL_VIEW",
        entityType: "OrganizationMembership",
        entityId: "preview",
      }
    );

    const preview = await previewOrganizationMembershipBackfillForTenantContext(
      tenantContext
    );

    return NextResponse.json(
      {
        mode: "preview",
        preview,
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
      { error: "Failed to load organization membership preview." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireRole(["SITE_ADMIN", "HR_ADMIN"], {
      attemptedAction: "ORGANIZATION_MEMBERSHIP_BACKFILL_APPLY",
      entityType: "OrganizationMembership",
      entityId: "apply",
    });

    const body = await request.json().catch(() => ({}));
    const apply = body?.apply === true;
    const result = await backfillOrganizationMemberships({
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
      { error: "Failed to run organization membership backfill." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

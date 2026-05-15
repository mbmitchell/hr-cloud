import type { TenantContext } from "../tenant-context";
import { previewOrganizationMembershipBackfill } from "./organization-membership-backfill";

export type OrganizationMembershipPreviewSummary = Awaited<
  ReturnType<typeof previewOrganizationMembershipBackfill>
>;

/**
 * Second read-only repository wrapper pilot.
 *
 * This wrapper accepts TenantContext so the service boundary can standardize on
 * the future tenant-aware call shape, but it intentionally does not apply any
 * filtering or query changes yet.
 */
export async function previewOrganizationMembershipBackfillForTenantContext(
  tenantContext: TenantContext
): Promise<OrganizationMembershipPreviewSummary> {
  const diagnosticsMetadata = {
    employeeId: tenantContext.employeeId,
    userId: tenantContext.userId,
    organizationId: tenantContext.organizationId,
    source: tenantContext.source,
    warningCount: tenantContext.warnings.length,
  };

  void diagnosticsMetadata;

  return previewOrganizationMembershipBackfill();
}

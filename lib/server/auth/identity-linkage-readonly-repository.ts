import type { TenantContext } from "../tenant-context";
import { getIdentityLinkageCoverageSummary } from "./identity-linkage";

export type IdentityLinkageCoverageSummary = Awaited<
  ReturnType<typeof getIdentityLinkageCoverageSummary>
>;

/**
 * Read-only repository wrapper pilot.
 *
 * The current implementation accepts TenantContext so routes and services can
 * begin standardizing their call shape, but it intentionally does not apply
 * tenant filtering yet. Query behavior and returned data remain identical to
 * the underlying diagnostics query.
 */
export async function getIdentityLinkageCoverageSummaryForTenantContext(
  tenantContext: TenantContext
): Promise<IdentityLinkageCoverageSummary> {
  const diagnosticsMetadata = {
    employeeId: tenantContext.employeeId,
    userId: tenantContext.userId,
    organizationId: tenantContext.organizationId,
    source: tenantContext.source,
    warningCount: tenantContext.warnings.length,
  };

  void diagnosticsMetadata;

  return getIdentityLinkageCoverageSummary();
}

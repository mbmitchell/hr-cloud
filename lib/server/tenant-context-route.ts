import {
  requireAdmin,
  requireRole,
  type AuthorizationActor,
} from "./authorization";
import {
  resolveTenantContext,
  type TenantContext,
} from "./tenant-context";

type RouteContext = {
  attemptedAction: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
};

export type AuthorizedTenantRouteResult = {
  actor: AuthorizationActor;
  tenantContext: TenantContext;
};

export async function requireRoleWithTenantContext(
  roleCodes: string[],
  context?: RouteContext
): Promise<AuthorizedTenantRouteResult> {
  const actor = await requireRole(roleCodes, context);
  const tenantContext = await resolveTenantContext();

  return {
    actor,
    tenantContext,
  };
}

export async function requireAdminWithTenantContext(
  context?: RouteContext
): Promise<AuthorizedTenantRouteResult> {
  const actor = await requireAdmin(context);
  const tenantContext = await resolveTenantContext();

  return {
    actor,
    tenantContext,
  };
}

/**
 * Server-Side Authorization Helpers
 *
 * Central entry point for authorization checks used by API routes and server
 * code throughout the MFN HR platform.
 *
 * Responsibilities:
 * - Resolve the authenticated internal employee ("actor")
 * - Enforce role-, permission-, and relationship-based access checks
 * - Provide consistent unauthorized/forbidden error handling
 * - Audit denied privileged actions
 *
 * Security considerations:
 * - Authorization is always enforced server-side
 * - Employee relationships such as manager/direct-report are verified from the
 *   database rather than trusting client state
 */
import type { Employee } from "@prisma/client";

import { prisma } from "../db";
import { getCurrentUser } from "../auth/current-user";
import {
  getApprovalScope,
  getDirectReportIds,
} from "../auth/access";
import {
  getEmployeePermissions,
  getEmployeeRoles,
  isManagerOf,
} from "../auth/permissions";
import { logSecurityEvent } from "./audit/security-events";

export class AuthorizationError extends Error {
  readonly status: number;
  readonly code: "UNAUTHORIZED" | "FORBIDDEN";

  constructor(
    message: string,
    options?: {
      status?: 401 | 403;
      code?: "UNAUTHORIZED" | "FORBIDDEN";
    }
  ) {
    super(message);
    this.name = "AuthorizationError";
    this.status = options?.status ?? 403;
    this.code =
      options?.code ?? (this.status === 401 ? "UNAUTHORIZED" : "FORBIDDEN");
  }
}

export type AuthorizationActor = Employee & {
  roles: string[];
  permissions: string[];
};

type EmployeeVisibilityRuleInput = {
  actorId: string;
  employeeId: string;
  actorRoles: string[];
  actorPermissions: string[];
  isManagerOfTarget: boolean;
};

type RequestCreationRuleInput = {
  actorId: string;
  employeeId: string;
  actorRoles: string[];
};

type AuthorizationContext = {
  attemptedAction: string;
  entityType: string;
  entityId?: string;
  details?: Record<string, unknown>;
};

function unauthorized(message = "You must be logged in.") {
  return new AuthorizationError(message, {
    status: 401,
    code: "UNAUTHORIZED",
  });
}

function forbidden(message = "You do not have permission to perform this action.") {
  return new AuthorizationError(message, {
    status: 403,
    code: "FORBIDDEN",
  });
}

async function auditAuthorizationFailure(
  context: AuthorizationContext | undefined,
  input: {
    actorId?: string | null;
    status: 401 | 403;
    reason: string;
  }
) {
  if (!context) {
    return;
  }

  try {
    await logSecurityEvent({
      eventType: "AUTHORIZATION_DENIED",
      provider: "internal",
      outcome: "denied",
      employeeId: input.actorId,
      reasonCode: input.reason,
      entityType: context.entityType,
      entityId: context.entityId ?? "unknown",
      metadata: {
        attemptedAction: context.attemptedAction,
        status: input.status,
        ...context.details,
      },
    });
  } catch (error) {
    console.error("Failed to write authorization audit log:", error);
  }
}

export function isAuthorizationError(
  error: unknown
): error is AuthorizationError {
  return error instanceof AuthorizationError;
}

async function getActorById(actorId: string): Promise<AuthorizationActor> {
  const user = await getCurrentUser();

  if (!user || user.id !== actorId) {
    throw unauthorized();
  }

  const [roles, permissions] = await Promise.all([
    getEmployeeRoles(user.id),
    getEmployeePermissions(user.id),
  ]);

  return {
    ...user,
    roles,
    permissions,
  };
}

function actorHasAnyRole(actor: AuthorizationActor, roleCodes: string[]) {
  return roleCodes.some((roleCode) => actor.roles.includes(roleCode));
}

function actorHasPermission(actor: AuthorizationActor, permissionCode: string) {
  return actor.permissions.includes(permissionCode);
}

function actorCanManageAllEmployees(actor: AuthorizationActor) {
  return (
    actorHasAnyRole(actor, ["SITE_ADMIN", "HR_ADMIN"]) ||
    actorHasPermission(actor, "VIEW_ALL_EMPLOYEES")
  );
}

export function canActorViewEmployee(input: EmployeeVisibilityRuleInput) {
  if (input.actorId === input.employeeId) {
    return true;
  }

  const actor = {
    id: input.actorId,
    roles: input.actorRoles,
    permissions: input.actorPermissions,
  } as Pick<AuthorizationActor, "id" | "roles" | "permissions">;

  if (
    actorCanManageAllEmployees(actor as AuthorizationActor) ||
    actorHasAnyRole(actor as AuthorizationActor, ["EXECUTIVE_READONLY", "AUDITOR"]) ||
    actorHasPermission(actor as AuthorizationActor, "VIEW_TEAM_PROFILE")
  ) {
    return true;
  }

  return input.isManagerOfTarget;
}

export function canActorCreateRequestFor(input: RequestCreationRuleInput) {
  if (input.actorId === input.employeeId) {
    return true;
  }

  return input.actorRoles.some((roleCode) =>
    ["SITE_ADMIN", "HR_ADMIN"].includes(roleCode)
  );
}

export async function requireActor(): Promise<AuthorizationActor> {
  const user = await getCurrentUser();

  if (!user) {
    throw unauthorized();
  }

  const [roles, permissions] = await Promise.all([
    getEmployeeRoles(user.id),
    getEmployeePermissions(user.id),
  ]);

  return {
    ...user,
    roles,
    permissions,
  };
}

/**
 * Resolves the currently authenticated employee and records denied access when
 * a route explicitly requires an authenticated internal user.
 */
export async function requireAuthenticatedEmployee(
  context?: AuthorizationContext
): Promise<AuthorizationActor> {
  try {
    return await requireActor();
  } catch (error) {
    if (isAuthorizationError(error)) {
      await auditAuthorizationFailure(context, {
        actorId: null,
        status: error.status === 401 ? 401 : 403,
        reason: error.message,
      });
    }

    throw error;
  }
}

/**
 * Enforces that the current actor has at least one of the required role codes.
 */
export async function requireRole(
  roleCodes: string[],
  context?: AuthorizationContext
): Promise<AuthorizationActor> {
  const actor = await requireAuthenticatedEmployee(context);

  if (actorHasAnyRole(actor, roleCodes)) {
    return actor;
  }

  await auditAuthorizationFailure(context, {
    actorId: actor.id,
    status: 403,
    reason: `Missing required role. Expected one of: ${roleCodes.join(", ")}`,
  });

  throw forbidden("You do not have permission to perform this action.");
}

export async function requireAdmin(
  context?: AuthorizationContext
): Promise<AuthorizationActor> {
  return requireRole(["SITE_ADMIN", "HR_ADMIN"], context);
}

/**
 * Enforces a direct-report relationship for manager-scoped actions.
 *
 * Admin bypass is optional so routes can keep tighter scoping where needed.
 */
export async function requireManagerOfEmployee(
  actorId: string,
  employeeId: string,
  context?: AuthorizationContext,
  options?: { allowAdmin?: boolean }
): Promise<AuthorizationActor> {
  const actor = await requireAuthenticatedEmployee(context);

  if (actor.id !== actorId) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 401,
      reason: "Actor mismatch while checking manager relationship.",
    });
    throw unauthorized();
  }

  if (options?.allowAdmin && actorHasAnyRole(actor, ["SITE_ADMIN", "HR_ADMIN"])) {
    return actor;
  }

  const managesEmployee = await isManagerOf(actor.id, employeeId);

  if (managesEmployee) {
    return actor;
  }

  await auditAuthorizationFailure(context, {
    actorId: actor.id,
    status: 403,
    reason: "Actor does not manage the target employee.",
  });

  throw forbidden("You do not have permission to act for this employee.");
}

export async function assertCanViewEmployee(
  actorId: string,
  employeeId: string
) {
  const actor = await getActorById(actorId);
  const managesEmployee = await isManagerOf(actor.id, employeeId);

  if (
    canActorViewEmployee({
      actorId: actor.id,
      employeeId,
      actorRoles: actor.roles,
      actorPermissions: actor.permissions,
      isManagerOfTarget: managesEmployee,
    })
  ) {
    return actor;
  }

  throw forbidden("You do not have permission to view this employee.");
}

/**
 * Validates whether the current actor can submit a PTO request for the target
 * employee. Self-service is allowed; acting for others currently requires
 * elevated HR/admin roles.
 */
export async function assertCanCreateRequestFor(
  actorId: string,
  employeeId: string
) {
  const actor = await getActorById(actorId);

  if (
    canActorCreateRequestFor({
      actorId: actor.id,
      employeeId,
      actorRoles: actor.roles,
    })
  ) {
    return actor;
  }

  throw forbidden("You do not have permission to create a request for this employee.");
}

/**
 * Ensures the current actor can approve or deny the target PTO request.
 *
 * Approval rules come from internal role/permission data plus the direct
 * reporting chain; the route should not duplicate that logic.
 */
export async function assertCanApproveRequest(
  actorId: string,
  requestId: string
) {
  const context: AuthorizationContext = {
    attemptedAction: "PTO_REQUEST_APPROVE",
    entityType: "PTORequest",
    entityId: requestId,
  };
  const actor = await requireAuthenticatedEmployee(context);

  if (actor.id !== actorId) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 401,
      reason: "Actor mismatch while checking request approval access.",
    });
    throw unauthorized();
  }

  const request = await prisma.pTORequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      employeeId: true,
    },
  });

  if (!request) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 403,
      reason: "Approval target request not found.",
    });
    throw forbidden("PTO request not found.");
  }

  const approvalScope = await getApprovalScope();

  if (approvalScope.user.id !== actor.id) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 401,
      reason: "Approval scope resolved for a different actor.",
    });
    throw unauthorized();
  }

  if (!approvalScope.allowed) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 403,
      reason: "Actor does not have request approval permission.",
    });
    throw forbidden("You do not have permission to approve requests.");
  }

  if (approvalScope.scope === "ALL") {
    return {
      actor,
      request,
      scope: approvalScope.scope,
      directReportIds: [] as string[],
    };
  }

  const directReportIds = await getDirectReportIds(actor.id);

  if (directReportIds.length === 0) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 403,
      reason: "Actor has no direct reports to approve for.",
    });
    throw forbidden("You do not have permission to approve this request.");
  }

  const canApprove = await isRequestForDirectReport(actor.id, request.employeeId);

  if (!canApprove) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 403,
      reason: "Actor attempted to approve a request for a non-direct-report employee.",
    });
    throw forbidden("You can only approve requests for your direct reports.");
  }

  return {
    actor,
    request,
    scope: approvalScope.scope,
    directReportIds,
  };
}

export async function assertCanManagePtoRequest(
  actorId: string,
  requestId: string,
  options?: { allowSelfPendingCancel?: boolean }
) {
  const context: AuthorizationContext = {
    attemptedAction: "PTO_REQUEST_MANAGE",
    entityType: "PTORequest",
    entityId: requestId,
  };
  const actor = await requireAuthenticatedEmployee(context);

  if (actor.id !== actorId) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 401,
      reason: "Actor mismatch while checking PTO request management access.",
    });
    throw unauthorized();
  }

  const request = await prisma.pTORequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      employeeId: true,
      status: true,
    },
  });

  if (!request) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 403,
      reason: "PTO request management target not found.",
    });
    throw forbidden("PTO request not found.");
  }

  if (
    options?.allowSelfPendingCancel &&
    request.employeeId === actor.id &&
    request.status === "PENDING"
  ) {
    return {
      actor,
      request,
      scope: "SELF_PENDING_CANCEL" as const,
    };
  }

  const approvalScope = await getApprovalScope();

  if (approvalScope.user.id !== actor.id) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 401,
      reason: "PTO management scope resolved for a different actor.",
    });
    throw unauthorized();
  }

  if (!approvalScope.allowed) {
    await auditAuthorizationFailure(context, {
      actorId: actor.id,
      status: 403,
      reason: "Actor does not have PTO request management permission.",
    });
    throw forbidden("You do not have permission to manage this PTO request.");
  }

  if (approvalScope.scope === "ALL") {
    return {
      actor,
      request,
      scope: approvalScope.scope,
    };
  }

  const managesEmployee = await isManagerOf(actor.id, request.employeeId);

  if (approvalScope.scope === "DIRECT_REPORTS" && managesEmployee) {
    return {
      actor,
      request,
      scope: approvalScope.scope,
    };
  }

  await auditAuthorizationFailure(context, {
    actorId: actor.id,
    status: 403,
    reason: "Actor attempted to manage a PTO request for a non-direct-report employee.",
  });
  throw forbidden("You can only manage PTO requests for your direct reports.");
}

async function isRequestForDirectReport(actorId: string, employeeId: string) {
  const actor = await getActorById(actorId);

  if (
    actorCanManageAllEmployees(actor) ||
    actorHasPermission(actor, "APPROVE_ALL_REQUESTS")
  ) {
    return true;
  }

  const directReportIds = await getDirectReportIds(actorId);

  if (directReportIds.length === 0) {
    return false;
  }

  const approvalScope = await getApprovalScope();

  if (!approvalScope.allowed || approvalScope.user.id !== actor.id) {
    return false;
  }

  if (!directReportIds.includes(employeeId)) {
    return false;
  }

  return isManagerOf(actorId, employeeId);
}

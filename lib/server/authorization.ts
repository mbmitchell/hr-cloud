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

export async function assertCanApproveRequest(
  actorId: string,
  requestId: string
) {
  const actor = await getActorById(actorId);
  const request = await prisma.pTORequest.findUnique({
    where: { id: requestId },
    select: {
      id: true,
      employeeId: true,
    },
  });

  if (!request) {
    throw forbidden("PTO request not found.");
  }

  const approvalScope = await getApprovalScope();

  if (approvalScope.user.id !== actor.id) {
    throw unauthorized();
  }

  if (!approvalScope.allowed) {
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
    throw forbidden("You do not have permission to approve this request.");
  }

  const canApprove = await isRequestForDirectReport(actor.id, request.employeeId);

  if (!canApprove) {
    throw forbidden("You can only approve requests for your direct reports.");
  }

  return {
    actor,
    request,
    scope: approvalScope.scope,
    directReportIds,
  };
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

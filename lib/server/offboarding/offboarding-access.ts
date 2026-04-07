import type { EmployeeOffboardingTask } from "@prisma/client";

import { isManagerOf } from "../../auth/permissions";
import {
  type AuthorizationActor,
  AuthorizationError,
  requireActor,
} from "../authorization";
import { OFFBOARDING_ADMIN_ROLES, OFFBOARDING_IT_ROLES } from "./types";

function hasAnyRole(actor: AuthorizationActor, roleCodes: readonly string[]) {
  return roleCodes.some((roleCode) => actor.roles.includes(roleCode));
}

export function isOffboardingAdmin(actor: AuthorizationActor) {
  return hasAnyRole(actor, OFFBOARDING_ADMIN_ROLES);
}

export function isOffboardingItUser(actor: AuthorizationActor) {
  return hasAnyRole(actor, OFFBOARDING_IT_ROLES);
}

export async function requireOffboardingActor() {
  return requireActor();
}

export function canCreateOffboarding(actor: AuthorizationActor) {
  return isOffboardingAdmin(actor);
}

export function canAccessOffboardingQueue(actor: AuthorizationActor) {
  return isOffboardingAdmin(actor) || actor.roles.includes("MANAGER") || isOffboardingItUser(actor);
}

export async function canViewOffboarding(
  actor: AuthorizationActor,
  offboarding: {
    employeeId: string;
    tasks?: Array<Pick<EmployeeOffboardingTask, "assigneeType">>;
  }
) {
  if (isOffboardingAdmin(actor)) {
    return true;
  }

  if (await isManagerOf(actor.id, offboarding.employeeId)) {
    return true;
  }

  return (
    isOffboardingItUser(actor) &&
    (offboarding.tasks ?? []).some((task) => task.assigneeType === "IT")
  );
}

export async function canUpdateOffboardingTask(
  actor: AuthorizationActor,
  offboardingEmployeeId: string,
  task: Pick<EmployeeOffboardingTask, "assigneeType">
) {
  if (isOffboardingAdmin(actor)) {
    return true;
  }

  if (
    task.assigneeType === "MANAGER" &&
    (await isManagerOf(actor.id, offboardingEmployeeId))
  ) {
    return true;
  }

  if (task.assigneeType === "IT" && isOffboardingItUser(actor)) {
    return true;
  }

  return false;
}

export function assertCanCreateOffboarding(actor: AuthorizationActor) {
  if (!canCreateOffboarding(actor)) {
    throw new AuthorizationError(
      "You do not have permission to create offboarding records.",
      { status: 403, code: "FORBIDDEN" }
    );
  }
}

export async function assertCanViewOffboarding(
  actor: AuthorizationActor,
  offboarding: {
    employeeId: string;
  }
) {
  if (!(await canViewOffboarding(actor, offboarding))) {
    throw new AuthorizationError(
      "You do not have permission to view this offboarding record.",
      { status: 403, code: "FORBIDDEN" }
    );
  }
}

export async function assertCanUpdateOffboardingTask(
  actor: AuthorizationActor,
  offboardingEmployeeId: string,
  task: Pick<EmployeeOffboardingTask, "assigneeType">
) {
  if (!(await canUpdateOffboardingTask(actor, offboardingEmployeeId, task))) {
    throw new AuthorizationError(
      "You do not have permission to update this offboarding task.",
      { status: 403, code: "FORBIDDEN" }
    );
  }
}

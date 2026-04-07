import type { AuthorizationActor } from "../authorization";
import {
  AuthorizationError,
  requireActor,
} from "../authorization";

function canActorManageEmployeeDocuments(actor: AuthorizationActor) {
  return actor.roles.some((roleCode) =>
    ["SITE_ADMIN", "HR_ADMIN"].includes(roleCode)
  );
}

export function canActorManageDocumentMetadata(actor: AuthorizationActor) {
  return canActorManageEmployeeDocuments(actor);
}

export function canActorAccessEmployeeDocuments(
  actor: AuthorizationActor,
  employeeId: string
) {
  if (canActorManageEmployeeDocuments(actor)) {
    return true;
  }

  return actor.id === employeeId;
}

export async function requireDocumentActor() {
  return requireActor();
}

export function assertCanAccessEmployeeDocuments(
  actor: AuthorizationActor,
  employeeId: string
) {
  if (canActorAccessEmployeeDocuments(actor, employeeId)) {
    return;
  }

  throw new AuthorizationError(
    "You do not have permission to access employee documents.",
    { status: 403, code: "FORBIDDEN" }
  );
}

export function assertCanAccessDocumentMetadata(
  actor: AuthorizationActor,
  employeeId: string
) {
  assertCanAccessEmployeeDocuments(actor, employeeId);
}

export function canActorUploadEmployeeDocuments(
  actor: AuthorizationActor,
  _employeeId: string
) {
  return canActorManageEmployeeDocuments(actor);
}

export function assertCanUploadEmployeeDocuments(
  actor: AuthorizationActor,
  employeeId: string
) {
  if (canActorUploadEmployeeDocuments(actor, employeeId)) {
    return;
  }

  throw new AuthorizationError(
    "You do not have permission to upload employee documents.",
    { status: 403, code: "FORBIDDEN" }
  );
}

export function assertCanManageDocumentMetadata(actor: AuthorizationActor) {
  if (canActorManageDocumentMetadata(actor)) {
    return;
  }

  throw new AuthorizationError(
    "You do not have permission to manage employee documents.",
    { status: 403, code: "FORBIDDEN" }
  );
}

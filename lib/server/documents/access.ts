import type { AuthorizationActor } from "../authorization";
import {
  AuthorizationError,
  requireActor,
} from "../authorization";
import { isSensitiveEmployeeDocumentCategory } from "../../documents/constants";

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

export function canActorAccessEmployeeDocumentCategory(
  actor: AuthorizationActor,
  employeeId: string,
  category: string
) {
  if (isSensitiveEmployeeDocumentCategory(category)) {
    return (
      actor.id === employeeId ||
      actor.roles.includes("SITE_ADMIN") ||
      actor.roles.includes("HR_ADMIN")
    );
  }

  return canActorAccessEmployeeDocuments(actor, employeeId);
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
  employeeId: string,
  category?: string
) {
  if (category) {
    if (canActorAccessEmployeeDocumentCategory(actor, employeeId, category)) {
      return;
    }

    throw new AuthorizationError(
      "You do not have permission to access this employee document.",
      { status: 403, code: "FORBIDDEN" }
    );
  }

  assertCanAccessEmployeeDocuments(actor, employeeId);
}

export function canActorUploadEmployeeDocuments(
  actor: AuthorizationActor,
  _employeeId: string,
  category?: string
) {
  if (category && isSensitiveEmployeeDocumentCategory(category)) {
    return actor.roles.some((roleCode) =>
      ["SITE_ADMIN", "HR_ADMIN"].includes(roleCode)
    );
  }

  return canActorManageEmployeeDocuments(actor);
}

export function assertCanUploadEmployeeDocuments(
  actor: AuthorizationActor,
  employeeId: string,
  category?: string
) {
  if (canActorUploadEmployeeDocuments(actor, employeeId, category)) {
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

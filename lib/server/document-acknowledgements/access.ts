import type { AuthorizationActor } from "../authorization";
import {
  AuthorizationError,
  requireActor,
} from "../authorization";
import { DOCUMENT_ACKNOWLEDGEMENT_ADMIN_ROLES } from "./types";

function hasAnyRole(actor: AuthorizationActor, roleCodes: readonly string[]) {
  return roleCodes.some((roleCode) => actor.roles.includes(roleCode));
}

export async function requireDocumentAcknowledgementActor() {
  return requireActor();
}

export function canManageDocumentAcknowledgements(actor: AuthorizationActor) {
  return hasAnyRole(actor, DOCUMENT_ACKNOWLEDGEMENT_ADMIN_ROLES);
}

export function canViewEmployeeDocumentAssignments(
  actor: AuthorizationActor,
  employeeId: string
) {
  if (canManageDocumentAcknowledgements(actor)) {
    return true;
  }

  return actor.id === employeeId;
}

export function canAcknowledgeDocumentAssignment(
  actor: AuthorizationActor,
  employeeId: string
) {
  return actor.id === employeeId;
}

export function assertCanManageDocumentAcknowledgements(
  actor: AuthorizationActor
) {
  if (canManageDocumentAcknowledgements(actor)) {
    return;
  }

  throw new AuthorizationError(
    "You do not have permission to manage document acknowledgements.",
    { status: 403, code: "FORBIDDEN" }
  );
}

export function assertCanViewEmployeeDocumentAssignments(
  actor: AuthorizationActor,
  employeeId: string
) {
  if (canViewEmployeeDocumentAssignments(actor, employeeId)) {
    return;
  }

  throw new AuthorizationError(
    "You do not have permission to view document assignments.",
    { status: 403, code: "FORBIDDEN" }
  );
}

export function assertCanAcknowledgeDocumentAssignment(
  actor: AuthorizationActor,
  employeeId: string
) {
  if (canAcknowledgeDocumentAssignment(actor, employeeId)) {
    return;
  }

  throw new AuthorizationError(
    "You do not have permission to acknowledge this document assignment.",
    { status: 403, code: "FORBIDDEN" }
  );
}


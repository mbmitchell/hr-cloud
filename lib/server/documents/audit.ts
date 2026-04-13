import { writeAuditLog } from "../audit/write-audit-log";
import { isSensitiveEmployeeDocumentCategory } from "../../documents/constants";

type DocumentAuditClient = {
  auditLog: {
    create(args: {
      data: {
        userId: string;
        action: string;
        entityType: string;
        entityId: string;
        oldValue: string | null;
        newValue: string | null;
      };
    }): Promise<unknown>;
  };
};

type DocumentAuditShape = {
  id: string;
  employeeId: string;
  category: string;
  originalFileName: string;
  description: string | null;
  status?: string;
};

export function isSensitiveDocumentCategory(category: string) {
  return isSensitiveEmployeeDocumentCategory(category);
}

export function serializeDocumentAuditShape(document: DocumentAuditShape) {
  return {
    employeeId: document.employeeId,
    category: document.category,
    originalFileName: document.originalFileName,
    description: document.description,
    status: document.status ?? "ACTIVE",
  };
}

export async function writeSensitiveDocumentAuditLog(
  tx: DocumentAuditClient,
  input: {
    actorId: string;
    action:
      | "EMPLOYEE_SENSITIVE_DOCUMENT_UPLOAD"
      | "EMPLOYEE_SENSITIVE_DOCUMENT_UPDATE"
      | "EMPLOYEE_SENSITIVE_DOCUMENT_VIEW"
      | "EMPLOYEE_SENSITIVE_DOCUMENT_DOWNLOAD";
    entityId: string;
    oldValue?: DocumentAuditShape;
    newValue?: DocumentAuditShape;
  }
) {
  const oldIsSensitive =
    input.oldValue && isSensitiveDocumentCategory(input.oldValue.category);
  const newIsSensitive =
    input.newValue && isSensitiveDocumentCategory(input.newValue.category);

  if (!oldIsSensitive && !newIsSensitive) {
    return;
  }

  await writeAuditLog(tx, {
    userId: input.actorId,
    action: input.action,
    entityType: "EmployeeDocument",
    entityId: input.entityId,
    oldValue: input.oldValue
      ? serializeDocumentAuditShape(input.oldValue)
      : undefined,
    newValue: input.newValue
      ? serializeDocumentAuditShape(input.newValue)
      : undefined,
  });
}

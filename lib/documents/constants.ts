export const EMPLOYEE_DOCUMENT_CATEGORIES = [
  "OFFER_LETTER",
  "POLICY",
  "PERFORMANCE_REVIEW",
  "HR_RECORD",
  "ONBOARDING",
  "OTHER",
] as const;

export type EmployeeDocumentCategory =
  (typeof EMPLOYEE_DOCUMENT_CATEGORIES)[number];

export const DEFAULT_DOCUMENT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const DEFAULT_DOCUMENT_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "image/jpeg",
  "image/png",
] as const;

export function isEmployeeDocumentCategory(
  value: string
): value is EmployeeDocumentCategory {
  return EMPLOYEE_DOCUMENT_CATEGORIES.includes(
    value as EmployeeDocumentCategory
  );
}

export function getAllowedDocumentMimeTypes() {
  const configured = process.env.DOCUMENT_ALLOWED_MIME_TYPES;

  if (!configured) {
    return Array.from(DEFAULT_DOCUMENT_ALLOWED_MIME_TYPES);
  }

  return configured
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function getDocumentMaxUploadBytes() {
  const configured = Number(process.env.DOCUMENT_MAX_UPLOAD_BYTES);

  if (!Number.isFinite(configured) || configured <= 0) {
    return DEFAULT_DOCUMENT_MAX_UPLOAD_BYTES;
  }

  return configured;
}

import { prisma } from "../../db";
import {
  getAllowedDocumentMimeTypes,
  getDocumentMaxUploadBytes,
  isEmployeeDocumentCategory,
} from "../../documents/constants";
import { assertCanUploadEmployeeDocuments } from "./access";
import { writeSensitiveDocumentAuditLog } from "./audit";
import { getEmployeeDocumentMetadataForActor } from "./queries";
import {
  buildEmployeeDocumentStorageKey,
  deleteDocumentFile,
  saveDocumentFile,
} from "./storage";
import type { AuthorizationActor } from "../authorization";

function normalizeDescription(value: string | null) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function createEmployeeDocument(input: {
  actor: AuthorizationActor;
  employeeId: string;
  category: string;
  description: string | null;
  file: File;
  skipUploadAuthorization?: boolean;
}) {
  if (!input.skipUploadAuthorization) {
    assertCanUploadEmployeeDocuments(input.actor, input.employeeId, input.category);
  }

  if (!isEmployeeDocumentCategory(input.category)) {
    throw new Error("Document category is invalid.");
  }

  if (!input.file || input.file.size === 0) {
    throw new Error("A document file is required.");
  }

  const maxUploadBytes = getDocumentMaxUploadBytes();
  if (input.file.size > maxUploadBytes) {
    throw new Error("Document file exceeds the maximum allowed size.");
  }

  const allowedMimeTypes = getAllowedDocumentMimeTypes();
  if (!input.file.type || !allowedMimeTypes.includes(input.file.type)) {
    throw new Error("Document file type is not allowed.");
  }

  const description = normalizeDescription(input.description);
  if (description && description.length > 2000) {
    throw new Error("Document description is too long.");
  }

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: { id: true },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const storageKey = buildEmployeeDocumentStorageKey({
    employeeId: employee.id,
    originalFileName: input.file.name,
  });
  const fileBuffer = Buffer.from(await input.file.arrayBuffer());

  await saveDocumentFile({
    storageKey,
    fileBuffer,
  });

  const storedFileName = storageKey.split("/").pop() ?? input.file.name;

  let createdDocument;
  try {
    createdDocument = await prisma.employeeDocument.create({
      data: {
        employeeId: employee.id,
        category: input.category,
        originalFileName: input.file.name,
        storedFileName,
        storageKey,
        mimeType: input.file.type,
        fileSizeBytes: input.file.size,
        description,
        uploadedByEmployeeId: input.actor.id,
      },
      select: { id: true },
    });
  } catch (error) {
    await deleteDocumentFile(storageKey);
    throw error;
  }

  const createdDocumentRecord = await prisma.employeeDocument.findUnique({
    where: { id: createdDocument.id },
    select: {
      id: true,
      employeeId: true,
      category: true,
      originalFileName: true,
      description: true,
      status: true,
    },
  });

  if (createdDocumentRecord) {
    await writeSensitiveDocumentAuditLog(prisma, {
      actorId: input.actor.id,
      action: "EMPLOYEE_SENSITIVE_DOCUMENT_UPLOAD",
      entityId: createdDocumentRecord.id,
      newValue: createdDocumentRecord,
    });
  }

  const metadata = await getEmployeeDocumentMetadataForActor(
    input.actor,
    createdDocument.id
  );

  if (!metadata) {
    throw new Error("Document metadata could not be loaded after upload.");
  }

  return metadata;
}

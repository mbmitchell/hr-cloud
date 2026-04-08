import { prisma } from "../../db";
import type { AuthorizationActor } from "../authorization";
import { AuthorizationError } from "../authorization";
import { assertCanAccessDocumentMetadata } from "./access";
import type { EmployeeDocumentMetadata } from "./types";
import { POLICY_DOCUMENT_INTERNAL_DESCRIPTION_PREFIX } from "../document-acknowledgements/types";

function mapEmployeeDocumentMetadata(document: {
  id: string;
  employeeId: string;
  category: string;
  originalFileName: string;
  mimeType: string;
  fileSizeBytes: number;
  description: string | null;
  status: string;
  uploadedAt: Date;
  uploadedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
}): EmployeeDocumentMetadata {
  return {
    id: document.id,
    employeeId: document.employeeId,
    category: document.category,
    originalFileName: document.originalFileName,
    mimeType: document.mimeType,
    fileSizeBytes: document.fileSizeBytes,
    description: document.description,
    status: document.status,
    uploadedAt: document.uploadedAt,
    uploader: {
      id: document.uploadedBy.id,
      firstName: document.uploadedBy.firstName,
      lastName: document.uploadedBy.lastName,
    },
  };
}

const employeeDocumentMetadataSelect = {
  id: true,
  employeeId: true,
  category: true,
  originalFileName: true,
  mimeType: true,
  fileSizeBytes: true,
  description: true,
  status: true,
  uploadedAt: true,
  uploadedBy: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
    },
  },
} as const;

export async function listEmployeeDocumentsForActor(
  actor: AuthorizationActor,
  employeeId: string
) {
  assertCanAccessDocumentMetadata(actor, employeeId);

  const documents = await prisma.employeeDocument.findMany({
    where: {
      employeeId,
      status: "ACTIVE",
      NOT: {
        description: {
          startsWith: POLICY_DOCUMENT_INTERNAL_DESCRIPTION_PREFIX,
        },
      },
    },
    select: employeeDocumentMetadataSelect,
    orderBy: [{ uploadedAt: "desc" }, { createdAt: "desc" }],
  });

  return documents.map(mapEmployeeDocumentMetadata);
}

export async function getEmployeeDocumentMetadataForActor(
  actor: AuthorizationActor,
  documentId: string
) {
  const document = await prisma.employeeDocument.findUnique({
    where: { id: documentId },
    select: employeeDocumentMetadataSelect,
  });

  if (!document) {
    return null;
  }

  assertCanAccessDocumentMetadata(actor, document.employeeId);

  return mapEmployeeDocumentMetadata(document);
}

export async function getEmployeeDocumentDownloadForActor(
  actor: AuthorizationActor,
  documentId: string
) {
  const document = await prisma.employeeDocument.findUnique({
    where: { id: documentId },
    select: {
      id: true,
      employeeId: true,
      originalFileName: true,
      mimeType: true,
      fileSizeBytes: true,
      storageKey: true,
      status: true,
    },
  });

  if (!document || document.status !== "ACTIVE") {
    return null;
  }

  try {
    assertCanAccessDocumentMetadata(actor, document.employeeId);
  } catch {
    const assignment = await prisma.employeeDocumentAssignment.findFirst({
      where: {
        employeeId: actor.id,
        status: {
          in: ["PENDING", "ACKNOWLEDGED"],
        },
        assignableDocumentVersion: {
          employeeDocumentId: document.id,
        },
      },
      select: {
        id: true,
      },
    });

    if (!assignment) {
      throw new AuthorizationError(
        "You do not have permission to access this document.",
        { status: 403, code: "FORBIDDEN" }
      );
    }
  }

  return document;
}

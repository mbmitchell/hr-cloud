import { prisma } from "../../db";
import { isEmployeeDocumentCategory } from "../../documents/constants";
import type { AuthorizationActor } from "../authorization";
import { assertCanManageDocumentMetadata } from "./access";
import { getEmployeeDocumentMetadataForActor } from "./queries";

function normalizeDescription(value: string | null | undefined) {
  if (value == null) {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function updateEmployeeDocument(input: {
  actor: AuthorizationActor;
  documentId: string;
  category?: string;
  description?: string | null;
  status?: string;
}) {
  assertCanManageDocumentMetadata(input.actor);

  const existing = await prisma.employeeDocument.findUnique({
    where: { id: input.documentId },
    select: {
      id: true,
      employeeId: true,
      status: true,
    },
  });

  if (!existing) {
    throw new Error("Document not found.");
  }

  const nextCategory =
    input.category === undefined ? undefined : String(input.category).trim();
  const nextStatus =
    input.status === undefined ? undefined : String(input.status).trim();
  const nextDescription = normalizeDescription(input.description);

  if (nextCategory !== undefined && !isEmployeeDocumentCategory(nextCategory)) {
    throw new Error("Document category is invalid.");
  }

  if (input.description !== undefined && nextDescription && nextDescription.length > 2000) {
    throw new Error("Document description is too long.");
  }

  if (nextStatus !== undefined && !["ACTIVE", "ARCHIVED"].includes(nextStatus)) {
    throw new Error("Document status is invalid.");
  }

  await prisma.employeeDocument.update({
    where: { id: existing.id },
    data: {
      ...(nextCategory === undefined ? {} : { category: nextCategory }),
      ...(input.description === undefined
        ? {}
        : { description: nextDescription }),
      ...(nextStatus === undefined ? {} : { status: nextStatus }),
    },
  });

  const document = await getEmployeeDocumentMetadataForActor(
    input.actor,
    existing.id
  );

  if (!document && nextStatus === "ARCHIVED") {
    return {
      id: existing.id,
      employeeId: existing.employeeId,
      status: "ARCHIVED",
    };
  }

  if (!document) {
    throw new Error("Document metadata could not be loaded after update.");
  }

  return document;
}

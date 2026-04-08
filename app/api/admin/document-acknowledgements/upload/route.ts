import { NextResponse } from "next/server";

import {
  getAllowedDocumentMimeTypes,
  getDocumentMaxUploadBytes,
} from "../../../../../lib/documents/constants";
import { prisma } from "../../../../../lib/db";
import {
  assertCanManageDocumentAcknowledgements,
  requireDocumentAcknowledgementActor,
} from "../../../../../lib/server/document-acknowledgements/access";
import { buildPolicyDocumentInternalDescription } from "../../../../../lib/server/document-acknowledgements/types";
import {
  buildEmployeeDocumentStorageKey,
  deleteDocumentFile,
  saveDocumentFile,
} from "../../../../../lib/server/documents/storage";
import { isAuthorizationError } from "../../../../../lib/server/authorization";

export async function POST(request: Request) {
  let storageKey: string | null = null;

  try {
    const actor = await requireDocumentAcknowledgementActor();
    assertCanManageDocumentAcknowledgements(actor);

    const formData = await request.formData();
    const assignableDocumentId = String(
      formData.get("assignableDocumentId") ?? ""
    ).trim();
    const versionLabel = String(formData.get("versionLabel") ?? "").trim();
    const notesValue = formData.get("notes");
    const notes =
      typeof notesValue === "string" && notesValue.trim().length > 0
        ? notesValue.trim()
        : null;
    const fileValue = formData.get("file");

    if (!assignableDocumentId || !versionLabel) {
      return NextResponse.json(
        { error: "Assignable document and version label are required." },
        { status: 400 }
      );
    }

    if (!(fileValue instanceof File) || fileValue.size === 0) {
      return NextResponse.json(
        { error: "A policy document file is required." },
        { status: 400 }
      );
    }

    const maxUploadBytes = getDocumentMaxUploadBytes();
    if (fileValue.size > maxUploadBytes) {
      return NextResponse.json(
        { error: "Document file exceeds the maximum allowed size." },
        { status: 400 }
      );
    }

    const allowedMimeTypes = getAllowedDocumentMimeTypes();
    if (!fileValue.type || !allowedMimeTypes.includes(fileValue.type)) {
      return NextResponse.json(
        { error: "Document file type is not allowed." },
        { status: 400 }
      );
    }

    if (notes && notes.length > 2000) {
      return NextResponse.json(
        { error: "Version notes are too long." },
        { status: 400 }
      );
    }

    const assignableDocument = await prisma.assignableDocument.findUnique({
      where: { id: assignableDocumentId },
      select: {
        id: true,
        category: true,
      },
    });

    if (!assignableDocument) {
      return NextResponse.json(
        { error: "Assignable document not found." },
        { status: 404 }
      );
    }

    storageKey = buildEmployeeDocumentStorageKey({
      employeeId: actor.id,
      originalFileName: fileValue.name,
    });

    await saveDocumentFile({
      storageKey,
      fileBuffer: Buffer.from(await fileValue.arrayBuffer()),
    });

    const storedFileName = storageKey.split("/").pop() ?? fileValue.name;

    const result = await prisma.$transaction(async (tx) => {
      const backingDocument = await tx.employeeDocument.create({
        data: {
          employeeId: actor.id,
          category: assignableDocument.category,
          originalFileName: fileValue.name,
          storedFileName,
          storageKey: storageKey!,
          mimeType: fileValue.type,
          fileSizeBytes: fileValue.size,
          description: buildPolicyDocumentInternalDescription(),
          status: "ACTIVE",
          uploadedByEmployeeId: actor.id,
        },
        select: {
          id: true,
          originalFileName: true,
        },
      });

      const version = await tx.assignableDocumentVersion.create({
        data: {
          assignableDocumentId: assignableDocument.id,
          versionLabel,
          employeeDocumentId: backingDocument.id,
          notes,
          publishedAt: new Date(),
          createdByEmployeeId: actor.id,
        },
        select: {
          id: true,
          versionLabel: true,
          publishedAt: true,
          employeeDocumentId: true,
        },
      });

      await tx.assignableDocument.update({
        where: { id: assignableDocument.id },
        data: {
          currentVersionId: version.id,
        },
      });

      return {
        version,
        backingDocument,
      };
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (storageKey) {
      await deleteDocumentFile(storageKey).catch(() => {});
    }

    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Policy document upload failed:", error);

    return NextResponse.json(
      { error: "Failed to upload policy document." },
      { status: 500 }
    );
  }
}

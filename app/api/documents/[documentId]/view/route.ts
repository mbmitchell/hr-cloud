import { NextResponse } from "next/server";

import { requireDocumentActor } from "../../../../../lib/server/documents/access";
import { writeSensitiveDocumentAuditLog } from "../../../../../lib/server/documents/audit";
import { getEmployeeDocumentDownloadForActor } from "../../../../../lib/server/documents/queries";
import { getDocumentFileStream } from "../../../../../lib/server/documents/storage";
import { prisma } from "../../../../../lib/db";
import { isAuthorizationError } from "../../../../../lib/server/authorization";

const INLINE_VIEW_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

const sensitiveDocumentHeaders = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

function buildInlineContentDisposition(fileName: string) {
  const safeFileName = fileName.replace(/["\r\n]/g, "_");
  return `inline; filename="${safeFileName}"`;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const actor = await requireDocumentActor();
    const { documentId } = await params;
    const document = await getEmployeeDocumentDownloadForActor(actor, documentId);

    if (!document) {
      return NextResponse.json(
        { error: "Document not found." },
        { status: 404, headers: sensitiveDocumentHeaders }
      );
    }

    if (!INLINE_VIEW_MIME_TYPES.has(document.mimeType)) {
      return NextResponse.json(
        { error: "This document type is not supported for in-browser viewing." },
        { status: 415, headers: sensitiveDocumentHeaders }
      );
    }

    try {
      const file = await getDocumentFileStream(document.storageKey);

      await writeSensitiveDocumentAuditLog(prisma, {
        actorId: actor.id,
        action: "EMPLOYEE_SENSITIVE_DOCUMENT_VIEW",
        entityId: document.id,
        newValue: {
          id: document.id,
          employeeId: document.employeeId,
          category: document.category,
          originalFileName: document.originalFileName,
          description: document.description,
          status: document.status,
        },
      });

      return new Response(file.stream, {
        headers: {
          ...sensitiveDocumentHeaders,
          "Content-Type": document.mimeType,
          "Content-Length": String(file.contentLength),
          "Content-Disposition": buildInlineContentDisposition(
            document.originalFileName
          ),
        },
      });
    } catch {
      return NextResponse.json(
        { error: "Document file not found." },
        { status: 404, headers: sensitiveDocumentHeaders }
      );
    }
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status, headers: sensitiveDocumentHeaders }
      );
    }

    console.error("Employee document view failed:", error);

    return NextResponse.json(
      { error: "Failed to view employee document." },
      { status: 500, headers: sensitiveDocumentHeaders }
    );
  }
}

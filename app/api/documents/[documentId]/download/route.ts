import { NextResponse } from "next/server";

import { requireDocumentActor } from "../../../../../lib/server/documents/access";
import { writeSensitiveDocumentAuditLog } from "../../../../../lib/server/documents/audit";
import { getEmployeeDocumentDownloadForActor } from "../../../../../lib/server/documents/queries";
import { getDocumentFileStream } from "../../../../../lib/server/documents/storage";
import { prisma } from "../../../../../lib/db";
import { isAuthorizationError } from "../../../../../lib/server/authorization";

const sensitiveDocumentHeaders = {
  "Cache-Control": "private, no-store",
  Pragma: "no-cache",
  "X-Content-Type-Options": "nosniff",
} as const;

function buildContentDisposition(fileName: string) {
  const safeFileName = fileName.replace(/["\r\n]/g, "_");
  return `attachment; filename="${safeFileName}"`;
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

    try {
      const file = await getDocumentFileStream(document.storageKey);

      await writeSensitiveDocumentAuditLog(prisma, {
        actorId: actor.id,
        action: "EMPLOYEE_SENSITIVE_DOCUMENT_DOWNLOAD",
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
          "Content-Disposition": buildContentDisposition(
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

    console.error("Employee document download failed:", error);

    return NextResponse.json(
      { error: "Failed to download employee document." },
      { status: 500, headers: sensitiveDocumentHeaders }
    );
  }
}

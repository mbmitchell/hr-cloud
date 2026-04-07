import { NextResponse } from "next/server";

import { requireDocumentActor } from "../../../../../lib/server/documents/access";
import { getEmployeeDocumentDownloadForActor } from "../../../../../lib/server/documents/queries";
import { getDocumentFileStream } from "../../../../../lib/server/documents/storage";
import { isAuthorizationError } from "../../../../../lib/server/authorization";

const INLINE_VIEW_MIME_TYPES = new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
]);

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
        { status: 404 }
      );
    }

    if (!INLINE_VIEW_MIME_TYPES.has(document.mimeType)) {
      return NextResponse.json(
        { error: "This document type is not supported for in-browser viewing." },
        { status: 415 }
      );
    }

    try {
      const file = await getDocumentFileStream(document.storageKey);

      return new Response(file.stream, {
        headers: {
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
        { status: 404 }
      );
    }
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    console.error("Employee document view failed:", error);

    return NextResponse.json(
      { error: "Failed to view employee document." },
      { status: 500 }
    );
  }
}

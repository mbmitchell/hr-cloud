import { NextResponse } from "next/server";

import { isEmployeeDocumentCategory } from "../../../../../lib/documents/constants";
import { prisma } from "../../../../../lib/db";
import { writeAuditLog } from "../../../../../lib/server/audit/write-audit-log";
import {
  assertCanManageDocumentAcknowledgements,
  requireDocumentAcknowledgementActor,
} from "../../../../../lib/server/document-acknowledgements/access";
import { isAuthorizationError } from "../../../../../lib/server/authorization";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireDocumentAcknowledgementActor();
    assertCanManageDocumentAcknowledgements(actor);
    const { id } = await params;

    const existing = await prisma.assignableDocument.findUnique({
      where: { id },
      select: { id: true, title: true, category: true, isActive: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Assignable document not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const category = String(body.category || "").trim();
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : undefined;

    if (!title) {
      return NextResponse.json(
        { error: "Document title is required." },
        { status: 400 }
      );
    }

    if (!isEmployeeDocumentCategory(category)) {
      return NextResponse.json(
        { error: "Document category is invalid." },
        { status: 400 }
      );
    }

    const document = await prisma.assignableDocument.update({
      where: { id },
      data: {
        title,
        category,
        ...(isActive === undefined ? {} : { isActive }),
      },
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "DOCUMENT_ACKNOWLEDGEMENT_UPDATE",
      entityType: "AssignableDocument",
      entityId: document.id,
      oldValue: {
        title: existing.title,
        category: existing.category,
        isActive: existing.isActive,
      },
      newValue: {
        title: document.title,
        category: document.category,
        isActive: document.isActive,
      },
    });

    return NextResponse.json({ document });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to update assignable document." },
      { status: 500 }
    );
  }
}

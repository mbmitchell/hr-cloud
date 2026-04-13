import { NextResponse } from "next/server";

import { isEmployeeDocumentCategory } from "../../../../lib/documents/constants";
import { prisma } from "../../../../lib/db";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";
import {
  requireDocumentAcknowledgementActor,
  assertCanManageDocumentAcknowledgements,
} from "../../../../lib/server/document-acknowledgements/access";
import {
  listAssignableDocumentsForAdmin,
  listAssignableEmployeeOptionsForAdmin,
} from "../../../../lib/server/document-acknowledgements/queries";
import { isAuthorizationError } from "../../../../lib/server/authorization";

export async function GET() {
  try {
    const actor = await requireDocumentAcknowledgementActor();
    assertCanManageDocumentAcknowledgements(actor);

    const [documents, employees] = await Promise.all([
      listAssignableDocumentsForAdmin(actor),
      listAssignableEmployeeOptionsForAdmin(actor),
    ]);

    return NextResponse.json({
      documents,
      employees,
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load document acknowledgements." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireDocumentAcknowledgementActor();
    assertCanManageDocumentAcknowledgements(actor);

    const body = await request.json();
    const title = String(body.title || "").trim();
    const category = String(body.category || "").trim();
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : true;

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

    const document = await prisma.assignableDocument.create({
      data: {
        title,
        category,
        isActive,
        createdByEmployeeId: actor.id,
      },
    });

    await writeAuditLog(prisma, {
      userId: actor.id,
      action: "DOCUMENT_ACKNOWLEDGEMENT_CREATE",
      entityType: "AssignableDocument",
      entityId: document.id,
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
      { error: "Failed to create assignable document." },
      { status: 500 }
    );
  }
}

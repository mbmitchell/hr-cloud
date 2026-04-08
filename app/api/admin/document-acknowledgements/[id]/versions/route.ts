import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/db";
import {
  assertCanManageDocumentAcknowledgements,
  requireDocumentAcknowledgementActor,
} from "../../../../../../lib/server/document-acknowledgements/access";
import { isPolicyDocumentInternalDescription } from "../../../../../../lib/server/document-acknowledgements/types";
import { isAuthorizationError } from "../../../../../../lib/server/authorization";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireDocumentAcknowledgementActor();
    assertCanManageDocumentAcknowledgements(actor);
    const { id } = await params;

    const body = await request.json();
    const policyDocumentId = String(
      body.policyDocumentId || body.employeeDocumentId || ""
    ).trim();
    const versionLabel = String(body.versionLabel || "").trim();
    const notes =
      body.notes == null || String(body.notes).trim() === ""
        ? null
        : String(body.notes).trim();
    const setAsCurrent =
      typeof body.setAsCurrent === "boolean" ? body.setAsCurrent : true;

    if (!policyDocumentId || !versionLabel) {
      return NextResponse.json(
        { error: "Policy document and version label are required." },
        { status: 400 }
      );
    }

    const [document, sourceDocument] = await Promise.all([
      prisma.assignableDocument.findUnique({
        where: { id },
        select: {
          id: true,
          category: true,
        },
      }),
      prisma.employeeDocument.findUnique({
        where: { id: policyDocumentId },
        select: {
          id: true,
          category: true,
          status: true,
          description: true,
        },
      }),
    ]);

    if (!document) {
      return NextResponse.json(
        { error: "Assignable document not found." },
        { status: 404 }
      );
    }

    if (
      !sourceDocument ||
      sourceDocument.status !== "ACTIVE" ||
      !isPolicyDocumentInternalDescription(sourceDocument.description)
    ) {
      return NextResponse.json(
        { error: "Policy document not found." },
        { status: 404 }
      );
    }

    if (sourceDocument.category !== document.category) {
      return NextResponse.json(
        {
          error:
            "Policy document category does not match the assignable document category.",
        },
        { status: 400 }
      );
    }

    const version = await prisma.$transaction(async (tx) => {
      const createdVersion = await tx.assignableDocumentVersion.create({
        data: {
          assignableDocumentId: document.id,
          versionLabel,
          employeeDocumentId: sourceDocument.id,
          notes,
          publishedAt: new Date(),
          createdByEmployeeId: actor.id,
        },
      });

      if (setAsCurrent) {
        await tx.assignableDocument.update({
          where: { id: document.id },
          data: {
            currentVersionId: createdVersion.id,
          },
        });
      }

      return createdVersion;
    });

    return NextResponse.json({ version });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to publish document version." },
      { status: 500 }
    );
  }
}

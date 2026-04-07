import { NextResponse } from "next/server";

import { requireDocumentActor } from "../../../../lib/server/documents/access";
import { updateEmployeeDocument } from "../../../../lib/server/documents/update-document";
import { isAuthorizationError } from "../../../../lib/server/authorization";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ documentId: string }> }
) {
  try {
    const actor = await requireDocumentActor();
    const { documentId } = await params;
    const body = (await request.json()) as Record<string, unknown>;

    const category =
      typeof body.category === "string" ? body.category : undefined;
    const description =
      typeof body.description === "string" || body.description === null
        ? body.description
        : undefined;
    const status = typeof body.status === "string" ? body.status : undefined;

    const document = await updateEmployeeDocument({
      actor,
      documentId,
      category,
      description,
      status,
    });

    return NextResponse.json({ document });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof Error) {
      if (
        error.message === "Document category is invalid." ||
        error.message === "Document description is too long." ||
        error.message === "Document status is invalid."
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (error.message === "Document not found.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    console.error("Employee document update failed:", error);

    return NextResponse.json(
      { error: "Failed to update employee document." },
      { status: 500 }
    );
  }
}

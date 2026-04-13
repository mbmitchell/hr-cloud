import { NextResponse } from "next/server";

import { createEmployeeDocument } from "../../../../../lib/server/documents/create-document";
import {
  isAuthorizationError,
} from "../../../../../lib/server/authorization";
import {
  listEmployeeDocumentsForActor,
} from "../../../../../lib/server/documents/queries";
import {
  requireDocumentActor,
} from "../../../../../lib/server/documents/access";
import { withPrivateNoStoreHeaders } from "../../../../../lib/server/http/headers";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireDocumentActor();
    const { id } = await params;
    const documents = await listEmployeeDocumentsForActor(actor, id);

    return NextResponse.json({ documents }, withPrivateNoStoreHeaders());
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return NextResponse.json(
      { error: "Failed to load employee documents." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireDocumentActor();
    const { id } = await params;
    const formData = await request.formData();
    const category = String(formData.get("category") ?? "").trim();
    const descriptionValue = formData.get("description");
    const description =
      typeof descriptionValue === "string" ? descriptionValue : null;
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { error: "A document file is required." },
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const document = await createEmployeeDocument({
      actor,
      employeeId: id,
      category,
      description,
      file: fileValue,
    });

    return NextResponse.json(
      { document },
      withPrivateNoStoreHeaders({ status: 201 })
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    if (error instanceof Error) {
      if (
        error.message === "A document file is required." ||
        error.message === "Document category is invalid." ||
        error.message === "Document file exceeds the maximum allowed size." ||
        error.message === "Document file type is not allowed." ||
        error.message === "Document description is too long."
      ) {
        return NextResponse.json(
          { error: error.message },
          withPrivateNoStoreHeaders({ status: 400 })
        );
      }

      if (error.message === "Employee not found.") {
        return NextResponse.json(
          { error: error.message },
          withPrivateNoStoreHeaders({ status: 404 })
        );
      }
    }

    console.error("Employee document upload failed:", error);

    return NextResponse.json(
      { error: "Failed to upload employee document." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

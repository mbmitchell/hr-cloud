import { NextResponse } from "next/server";

import { acknowledgeDocumentAssignment } from "../../../../../lib/server/document-acknowledgements/acknowledge";
import { isAuthorizationError } from "../../../../../lib/server/authorization";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params;
    const assignment = await acknowledgeDocumentAssignment(assignmentId);

    return NextResponse.json({ assignment });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof Error) {
      if (error.message === "Document assignment not found.") {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (
        error.message === "Document assignment has already been acknowledged." ||
        error.message === "Cancelled document assignments cannot be acknowledged." ||
        error.message === "You must view the document before acknowledging."
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: "Failed to acknowledge document." },
      { status: 500 }
    );
  }
}

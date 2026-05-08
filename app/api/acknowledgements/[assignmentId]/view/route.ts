import { NextResponse } from "next/server";

import { markDocumentAssignmentViewed } from "../../../../../lib/server/document-acknowledgements/acknowledge";
import { isAuthorizationError } from "../../../../../lib/server/authorization";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ assignmentId: string }> }
) {
  try {
    const { assignmentId } = await params;
    const assignment = await markDocumentAssignmentViewed(assignmentId);

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

      if (error.message === "Cancelled document assignments cannot be viewed.") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: "Failed to mark document as viewed." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

import { requireOnboardingActor } from "../../../../../../../../../lib/server/onboarding";
import { isAuthorizationError } from "../../../../../../../../../lib/server/authorization";
import { uploadEmployeeDocumentForOnboardingRequirement } from "../../../../../../../../../lib/server/onboarding-documents";

export async function POST(
  request: Request,
  {
    params,
  }: {
    params: Promise<{ id: string; taskId: string; requirementId: string }>;
  }
) {
  try {
    const actor = await requireOnboardingActor();
    const { id, taskId, requirementId } = await params;
    const formData = await request.formData();
    const fileValue = formData.get("file");

    if (!(fileValue instanceof File)) {
      return NextResponse.json(
        { error: "A document file is required." },
        { status: 400 }
      );
    }

    const result = await uploadEmployeeDocumentForOnboardingRequirement({
      actor,
      onboardingId: id,
      taskId,
      requirementId,
      file: fileValue,
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
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
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (
        error.message === "Onboarding record not found." ||
        error.message === "Onboarding task not found." ||
        error.message === "Onboarding document requirement not found." ||
        error.message === "Employee not found."
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    console.error("Onboarding required document upload failed:", error);

    return NextResponse.json(
      { error: "Failed to upload required onboarding document." },
      { status: 500 }
    );
  }
}

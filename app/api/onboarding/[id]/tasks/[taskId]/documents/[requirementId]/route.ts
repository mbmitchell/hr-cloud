import { NextResponse } from "next/server";

import { requireOnboardingActor } from "../../../../../../../../lib/server/onboarding";
import { isAuthorizationError } from "../../../../../../../../lib/server/authorization";
import { linkEmployeeDocumentToOnboardingRequirement } from "../../../../../../../../lib/server/onboarding-documents";

export async function PATCH(
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
    const body = (await request.json()) as Record<string, unknown>;
    const employeeDocumentId = String(body.employeeDocumentId || "").trim();

    if (!employeeDocumentId) {
      return NextResponse.json(
        { error: "Employee document is required." },
        { status: 400 }
      );
    }

    const requirement = await linkEmployeeDocumentToOnboardingRequirement({
      actor,
      onboardingId: id,
      taskId,
      requirementId,
      employeeDocumentId,
    });

    return NextResponse.json({ requirement });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof Error) {
      if (error.message === "Employee document is required.") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }

      if (
        error.message === "Onboarding record not found." ||
        error.message === "Onboarding task not found." ||
        error.message === "Onboarding document requirement not found." ||
        error.message === "Employee document not found."
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (
        error.message ===
          "Employee document does not belong to this onboarding employee." ||
        error.message ===
          "Employee document category does not match requirement."
      ) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    console.error("Onboarding document requirement link failed:", error);

    return NextResponse.json(
      { error: "Failed to link onboarding document requirement." },
      { status: 500 }
    );
  }
}

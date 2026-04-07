import { NextResponse } from "next/server";

import { isOnboardingTaskStatus } from "../../../../../../lib/onboarding/constants";
import {
  requireOnboardingActor,
  updateOnboardingTaskStatus,
} from "../../../../../../lib/server/onboarding";
import { isAuthorizationError } from "../../../../../../lib/server/authorization";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const actor = await requireOnboardingActor();
    const { id, taskId } = await params;
    const body = await request.json();
    const status = String(body.status || "").trim();

    if (!isOnboardingTaskStatus(status)) {
      return NextResponse.json(
        { error: "Task status is invalid." },
        { status: 400 }
      );
    }

    const task = await updateOnboardingTaskStatus({
      actor,
      onboardingId: id,
      taskId,
      status,
    });

    return NextResponse.json({ task });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof Error) {
      if (
        error.message === "Onboarding record not found." ||
        error.message === "Onboarding task not found."
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to update onboarding task." },
      { status: 500 }
    );
  }
}

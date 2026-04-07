import { NextResponse } from "next/server";

import { requireOffboardingActor } from "../../../../../../lib/server/offboarding/offboarding-access";
import { updateOffboardingTaskStatus } from "../../../../../../lib/server/offboarding/offboarding-queries";
import { isOffboardingTaskStatus } from "../../../../../../lib/server/offboarding/types";
import { isAuthorizationError } from "../../../../../../lib/server/authorization";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; taskId: string }> }
) {
  try {
    const actor = await requireOffboardingActor();
    const { id, taskId } = await params;
    const body = await request.json();
    const status = String(body.status || "").trim();

    if (!isOffboardingTaskStatus(status)) {
      return NextResponse.json(
        { error: "Task status is invalid." },
        { status: 400 }
      );
    }

    const task = await updateOffboardingTaskStatus({
      actor,
      offboardingId: id,
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
        error.message === "Offboarding record not found." ||
        error.message === "Offboarding task not found."
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: "Failed to update offboarding task." },
      { status: 500 }
    );
  }
}

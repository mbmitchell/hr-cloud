import { NextResponse } from "next/server";

import {
  createOnboardingFromTemplate,
  isOnboardingAdmin,
  listVisibleOnboardings,
  requireOnboardingActor,
} from "../../../lib/server/onboarding";
import { isAuthorizationError } from "../../../lib/server/authorization";

export async function GET() {
  try {
    const actor = await requireOnboardingActor();
    const onboardings = await listVisibleOnboardings(actor);

    return NextResponse.json({ onboardings });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load onboarding records." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOnboardingActor();

    if (!isOnboardingAdmin(actor)) {
      return NextResponse.json(
        { error: "You do not have permission to create onboarding records." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const employeeId = String(body.employeeId || "").trim();
    const templateId = String(body.templateId || "").trim();

    if (!employeeId || !templateId) {
      return NextResponse.json(
        { error: "Employee and template are required." },
        { status: 400 }
      );
    }

    const onboarding = await createOnboardingFromTemplate({
      employeeId,
      templateId,
      actorId: actor.id,
    });

    return NextResponse.json({ onboarding });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    if (error instanceof Error) {
      if (
        error.message === "Employee not found." ||
        error.message === "Onboarding template not found."
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (error.message === "An onboarding record already exists for this employee.") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: "Failed to create onboarding record." },
      { status: 500 }
    );
  }
}

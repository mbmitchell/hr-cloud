import { NextResponse } from "next/server";

import {
  getOnboardingDetailForActor,
  requireOnboardingActor,
} from "../../../../lib/server/onboarding";
import {
  isAuthorizationError,
} from "../../../../lib/server/authorization";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireOnboardingActor();
    const { id } = await params;
    const onboarding = await getOnboardingDetailForActor(actor, id);

    if (!onboarding) {
      return NextResponse.json(
        { error: "Onboarding record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ onboarding });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load onboarding record." },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";

import { requireOffboardingActor } from "../../../../lib/server/offboarding/offboarding-access";
import { getOffboardingById } from "../../../../lib/server/offboarding/offboarding-queries";
import { isAuthorizationError } from "../../../../lib/server/authorization";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const actor = await requireOffboardingActor();
    const { id } = await params;
    const offboarding = await getOffboardingById(actor, id);

    if (!offboarding) {
      return NextResponse.json(
        { error: "Offboarding record not found." },
        { status: 404 }
      );
    }

    return NextResponse.json({ offboarding });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load offboarding record." },
      { status: 500 }
    );
  }
}

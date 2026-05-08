import { NextResponse } from "next/server";

import { createEmployeeOffboarding } from "../../../lib/server/offboarding/create-offboarding";
import {
  canAccessOffboardingQueue,
  isOffboardingAdmin,
  requireOffboardingActor,
} from "../../../lib/server/offboarding/offboarding-access";
import { getOffboardingQueue } from "../../../lib/server/offboarding/offboarding-queries";
import { isOffboardingSeparationType } from "../../../lib/server/offboarding/types";
import { isAuthorizationError } from "../../../lib/server/authorization";

export async function GET() {
  try {
    const actor = await requireOffboardingActor();

    if (!canAccessOffboardingQueue(actor)) {
      return NextResponse.json(
        { error: "You do not have permission to view offboarding records." },
        { status: 403 }
      );
    }

    const offboardings = await getOffboardingQueue(actor);

    return NextResponse.json({ offboardings });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load offboarding records." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requireOffboardingActor();

    if (!isOffboardingAdmin(actor)) {
      return NextResponse.json(
        { error: "You do not have permission to create offboarding records." },
        { status: 403 }
      );
    }

    const body = await request.json();
    const employeeId = String(body.employeeId || "").trim();
    const templateId = String(body.templateId || "").trim();
    const separationType = String(body.separationType || "").trim();
    const terminationDateValue = String(body.terminationDate || "").trim();
    const lastWorkingDateValue = String(body.lastWorkingDate || "").trim();
    const notes = typeof body.notes === "string" ? body.notes : null;
    const eligibleForRehire =
      typeof body.eligibleForRehire === "boolean"
        ? body.eligibleForRehire
        : null;

    if (!employeeId || !separationType || !terminationDateValue) {
      return NextResponse.json(
        { error: "Employee, separation type, and termination date are required." },
        { status: 400 }
      );
    }

    if (!isOffboardingSeparationType(separationType)) {
      return NextResponse.json(
        { error: "Separation type is invalid." },
        { status: 400 }
      );
    }

    const terminationDate = new Date(terminationDateValue);

    if (Number.isNaN(terminationDate.getTime())) {
      return NextResponse.json(
        { error: "Termination date is invalid." },
        { status: 400 }
      );
    }

    let lastWorkingDate: Date | null = null;
    if (lastWorkingDateValue) {
      lastWorkingDate = new Date(lastWorkingDateValue);

      if (Number.isNaN(lastWorkingDate.getTime())) {
        return NextResponse.json(
          { error: "Last working date is invalid." },
          { status: 400 }
        );
      }
    }

    const offboarding = await createEmployeeOffboarding({
      actorId: actor.id,
      employeeId,
      templateId: templateId || null,
      separationType,
      terminationDate,
      lastWorkingDate,
      eligibleForRehire,
      notes,
    });

    return NextResponse.json({ offboarding });
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
        error.message === "Offboarding template not found."
      ) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }

      if (error.message === "An offboarding record already exists for this employee.") {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }

    return NextResponse.json(
      { error: "Failed to create offboarding record." },
      { status: 500 }
    );
  }
}

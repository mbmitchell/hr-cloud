import { NextResponse } from "next/server";

import { runMonthlyAccruals } from "../../../../lib/pto/accrual-job";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../lib/server/authorization";

export async function POST(request: Request) {
  try {
    await requireRole(["SITE_ADMIN"], {
      attemptedAction: "ACCRUAL_RUN",
      entityType: "PTOLedger",
      entityId: "monthly-accrual-job",
    });

    const body = await request.json().catch(() => ({}));
    const runDateValue = body?.runDate ? new Date(String(body.runDate)) : new Date();

    if (Number.isNaN(runDateValue.getTime())) {
      return NextResponse.json(
        { error: "Invalid run date." },
        { status: 400 }
      );
    }

    const result = await runMonthlyAccruals(runDateValue);

    return NextResponse.json(result);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to run monthly accruals." },
      { status: 500 }
    );
  }
}

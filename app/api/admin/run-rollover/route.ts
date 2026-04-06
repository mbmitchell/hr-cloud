import { NextResponse } from "next/server";

import { runYearEndRollover } from "../../../../lib/pto/rollover-job";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../lib/server/authorization";

export async function POST(request: Request) {
  try {
    await requireRole(["SITE_ADMIN"], {
      attemptedAction: "ROLLOVER_RUN",
      entityType: "PTOLedger",
      entityId: "year-end-rollover-job",
    });

    const body = await request.json().catch(() => ({}));
    const runDateValue = body?.runDate ? new Date(String(body.runDate)) : new Date();

    if (Number.isNaN(runDateValue.getTime())) {
      return NextResponse.json(
        { error: "Invalid run date." },
        { status: 400 }
      );
    }

    const result = await runYearEndRollover(runDateValue);

    return NextResponse.json(result);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to run year-end rollover." },
      { status: 500 }
    );
  }
}

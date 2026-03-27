import { NextResponse } from "next/server";
import { runYearEndRollover } from "../../../../lib/pto/rollover-job";
import { canCurrentUserRunRollover } from "../../../../lib/auth/access";

export async function POST(request: Request) {
  try {
    const allowed = await canCurrentUserRunRollover();

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to run year-end rollover." },
        { status: 403 }
      );
    }

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
  } catch {
    return NextResponse.json(
      { error: "Failed to run year-end rollover." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";
import { runMonthlyAccruals } from "../../../../lib/pto/accrual-job";
import { canCurrentUserRunAccruals } from "../../../../lib/auth/access";

export async function POST(request: Request) {
  try {
    const allowed = await canCurrentUserRunAccruals();

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to run monthly accruals." },
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

    const result = await runMonthlyAccruals(runDateValue);

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(
      { error: "Failed to run monthly accruals." },
      { status: 500 }
    );
  }
}
import { NextResponse } from "next/server";

import { withPrivateNoStoreHeaders } from "../../../../lib/server/http/headers";
import { runMonthlyPtoAccrualJob } from "../../../../lib/server/internal-jobs/pto";
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
        withPrivateNoStoreHeaders({ status: 400 })
      );
    }

    const job = await runMonthlyPtoAccrualJob({
      runDate: runDateValue,
    });

    return NextResponse.json(
      {
        ...(job.result ?? {
          runDate: new Date(runDateValue.getFullYear(), runDateValue.getMonth(), 1).toISOString(),
          processedEmployees: 0,
          skippedEmployees: 0,
          createdEntries: 0,
          details: [],
        }),
        scheduledJobRun: job.run,
        deduplicated: job.deduplicated,
      },
      withPrivateNoStoreHeaders()
    );
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        withPrivateNoStoreHeaders({ status: error.status })
      );
    }

    return NextResponse.json(
      { error: "Failed to run monthly accruals." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

import {
  assertInternalJobAuth,
  isInternalJobAuthError,
} from "../../../../../../lib/server/internal-jobs/auth";
import {
  getInternalJobRunKey,
  getOptionalInternalJobRunDate,
  getScheduledJobErrorResponse,
  internalJobJson,
} from "../../../../../../lib/server/internal-jobs/http";
import { runMonthlyPtoAccrualJob } from "../../../../../../lib/server/internal-jobs/pto";

async function handleRequest(request: Request) {
  try {
    assertInternalJobAuth(request);

    const { error, runDate } = await getOptionalInternalJobRunDate(request);

    if (error) {
      return internalJobJson({ error }, { status: 400 });
    }

    const result = await runMonthlyPtoAccrualJob({
      runKey: getInternalJobRunKey(request),
      runDate,
    });

    return internalJobJson({ result });
  } catch (error) {
    if (isInternalJobAuthError(error)) {
      return internalJobJson({ error: error.message }, { status: error.status });
    }

    return getScheduledJobErrorResponse(
      error,
      "Failed to run monthly PTO accrual job."
    );
  }
}

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

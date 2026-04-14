import {
  assertInternalJobAuth,
  isInternalJobAuthError,
} from "../../../../../../lib/server/internal-jobs/auth";
import {
  internalJobJson,
  getInternalJobRunKey,
  getScheduledJobErrorResponse,
} from "../../../../../../lib/server/internal-jobs/http";
import { runNotificationProcessingJob } from "../../../../../../lib/server/internal-jobs/automation";

async function handleRequest(request: Request) {
  try {
    assertInternalJobAuth(request);

    const result = await runNotificationProcessingJob({
      runKey: getInternalJobRunKey(request),
    });

    return internalJobJson({ result });
  } catch (error) {
    if (isInternalJobAuthError(error)) {
      return internalJobJson({ error: error.message }, { status: error.status });
    }

    return getScheduledJobErrorResponse(
      error,
      "Failed to process notifications."
    );
  }
}

export async function GET(request: Request) {
  return handleRequest(request);
}

export async function POST(request: Request) {
  return handleRequest(request);
}

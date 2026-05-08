import { NextResponse } from "next/server";

import { withPrivateNoStoreHeaders } from "../http/headers";
import { getScheduledJobRunErrorRun } from "./execute";

export function getInternalJobRunKey(request: Request) {
  const headerValue = request.headers.get("X-INTERNAL-JOB-RUN-KEY")?.trim();

  if (headerValue) {
    return headerValue;
  }

  const url = new URL(request.url);
  const queryValue = url.searchParams.get("runKey")?.trim();

  return queryValue || undefined;
}

export async function getOptionalInternalJobRunDate(request: Request) {
  const url = new URL(request.url);
  const queryValue = url.searchParams.get("runDate")?.trim();

  if (queryValue) {
    const parsed = new Date(queryValue);

    if (Number.isNaN(parsed.getTime())) {
      return {
        error: "Invalid run date.",
        runDate: null as Date | null,
      };
    }

    return {
      error: null,
      runDate: parsed,
    };
  }

  if (request.method !== "POST") {
    return {
      error: null,
      runDate: null as Date | null,
    };
  }

  const body = await request.clone().json().catch(() => ({}));
  const bodyValue =
    body && typeof body === "object" && "runDate" in body
      ? String((body as { runDate?: unknown }).runDate ?? "").trim()
      : "";

  if (!bodyValue) {
    return {
      error: null,
      runDate: null as Date | null,
    };
  }

  const parsed = new Date(bodyValue);

  if (Number.isNaN(parsed.getTime())) {
    return {
      error: "Invalid run date.",
      runDate: null as Date | null,
    };
  }

  return {
    error: null,
    runDate: parsed,
  };
}

export function internalJobJson(body: unknown, init?: ResponseInit) {
  return NextResponse.json(body, withPrivateNoStoreHeaders(init));
}

export function getScheduledJobErrorResponse(error: unknown, fallbackMessage: string) {
  const run = getScheduledJobRunErrorRun(error);

  return internalJobJson(
    {
      error: fallbackMessage,
      run,
    },
    { status: 500 }
  );
}

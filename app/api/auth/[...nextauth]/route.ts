import type { NextRequest } from "next/server";

import { AuthError } from "next-auth";
import { NextResponse } from "next/server";
import { handlers } from "../../../../auth";
import { logSecurityEvent } from "../../../../lib/server/audit/security-events";
import {
  AUTH_RATE_LIMITS,
  consumeAuthRateLimit,
  getClientIpFromRequest,
  isCredentialsCallbackRoutePath,
  isMicrosoftEntraRoutePath,
} from "../../../../lib/server/security/auth-rate-limit";

function buildAuthRateLimitResponse(retryAfterSeconds: number) {
  return new Response("Unable to sign in right now. Please try again later.", {
    status: 429,
    headers: {
      "Retry-After": String(retryAfterSeconds),
    },
  });
}

function getAuthErrorType(error: unknown) {
  const nestedError =
    typeof error === "object" &&
    error !== null &&
    "cause" in error &&
    typeof error.cause === "object" &&
    error.cause !== null &&
    "err" in error.cause
      ? error.cause.err
      : null;

  if (nestedError instanceof AuthError) {
    return nestedError.type;
  }

  if (
    typeof nestedError === "object" &&
    nestedError !== null &&
    "type" in nestedError &&
    typeof nestedError.type === "string"
  ) {
    return nestedError.type;
  }

  if (nestedError instanceof Error) {
    return nestedError.name;
  }

  if (error instanceof AuthError) {
    return error.type;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "type" in error &&
    typeof error.type === "string"
  ) {
    return error.type;
  }

  if (error instanceof Error) {
    return error.name;
  }

  return "Callback";
}

function buildLoginErrorRedirect(request: NextRequest, errorType: string) {
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("error", errorType);
  return NextResponse.redirect(loginUrl);
}

function logAuthRouteError(request: NextRequest, error: unknown) {
  const errorType = getAuthErrorType(error);
  const url = new URL(request.url);
  const details =
    error instanceof Error
      ? {
          message: error.message,
          causeType:
            typeof error.cause === "object" &&
            error.cause !== null &&
            "err" in error.cause &&
            error.cause.err instanceof Error
              ? error.cause.err.name
              : undefined,
          causeMessage:
            typeof error.cause === "object" &&
            error.cause !== null &&
            "err" in error.cause &&
            error.cause.err instanceof Error
              ? error.cause.err.message
              : undefined,
        }
      : {
          message: String(error),
        };

  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      scope: "auth-route",
      event: "auth.error",
      type: errorType,
      method: request.method,
      path: url.pathname,
      hasCsrfCookie: Boolean(request.cookies.get("authjs.csrf-token")),
      hasCallbackUrlCookie: Boolean(request.cookies.get("authjs.callback-url")),
      hasPkceCookie: Boolean(
        request.cookies.get("authjs.pkce.code_verifier")
      ),
      hasSessionCookie: request.cookies
        .getAll()
        .some((cookie) => cookie.name.startsWith("authjs.session-token")),
      hasStateParam: url.searchParams.has("state"),
      ...details,
    })
  );
}

async function enforceAuthRouteRateLimit(request: NextRequest) {
  const { pathname } = new URL(request.url);

  if (isCredentialsCallbackRoutePath(pathname)) {
    return null;
  }

  if (!isMicrosoftEntraRoutePath(pathname)) {
    return null;
  }

  const clientIp = getClientIpFromRequest(request);
  const result = consumeAuthRateLimit(
    `auth:microsoft-route:ip:${clientIp}`,
    AUTH_RATE_LIMITS.microsoftRouteByIp
  );

  if (result.allowed) {
    return null;
  }

  await logSecurityEvent({
    eventType: "AUTH_RATE_LIMITED",
    provider: "microsoft-entra-id",
    outcome: "denied",
    reasonCode: "too_many_requests",
    entityType: "AuthSession",
    entityId: clientIp,
    metadata: {
      clientIp,
      path: pathname,
      retryAfterSeconds: result.retryAfterSeconds,
    },
  });

  return buildAuthRateLimitResponse(result.retryAfterSeconds);
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await enforceAuthRouteRateLimit(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    return await handlers.GET(request);
  } catch (error) {
    logAuthRouteError(request, error);
    return buildLoginErrorRedirect(request, getAuthErrorType(error));
  }
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceAuthRouteRateLimit(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    return await handlers.POST(request);
  } catch (error) {
    logAuthRouteError(request, error);
    return buildLoginErrorRedirect(request, getAuthErrorType(error));
  }
}

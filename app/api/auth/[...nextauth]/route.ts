import type { NextRequest } from "next/server";

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

  return handlers.GET(request);
}

export async function POST(request: NextRequest) {
  const rateLimitResponse = await enforceAuthRouteRateLimit(request);

  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  return handlers.POST(request);
}

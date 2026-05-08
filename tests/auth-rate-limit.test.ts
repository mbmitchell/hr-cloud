import test from "node:test";
import assert from "node:assert/strict";

import {
  AUTH_RATE_LIMITS,
  buildCredentialsRateLimitKeys,
  clearAuthRateLimitStateForTests,
  consumeAuthRateLimit,
  getClientIpFromHeaders,
  isMicrosoftEntraRoutePath,
} from "../lib/server/security/auth-rate-limit";

test("credentials limiter blocks after configured threshold", () => {
  clearAuthRateLimitStateForTests();

  const key = "auth:credentials:ip:127.0.0.1";
  let lastResult = null;

  for (let index = 0; index < AUTH_RATE_LIMITS.credentialsByIp.limit + 1; index += 1) {
    lastResult = consumeAuthRateLimit(key, AUTH_RATE_LIMITS.credentialsByIp);
  }

  assert.ok(lastResult);
  assert.equal(lastResult.allowed, false);
  assert.ok(lastResult.retryAfterSeconds >= 1);
});

test("credentials limiter keys by ip and normalized email", () => {
  assert.deepEqual(
    buildCredentialsRateLimitKeys({
      clientIp: "10.0.0.5",
      normalizedEmail: "employee@example.com",
    }),
    [
      "auth:credentials:ip:10.0.0.5",
      "auth:credentials:ip-email:10.0.0.5:employee@example.com",
    ]
  );
});

test("client ip extraction prefers forwarded headers", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.10, 10.0.0.5",
    "x-real-ip": "10.0.0.5",
  });

  assert.equal(getClientIpFromHeaders(headers), "203.0.113.10");
});

test("microsoft route detection only flags sensitive auth endpoints", () => {
  assert.equal(
    isMicrosoftEntraRoutePath("/api/auth/signin/microsoft-entra-id"),
    true
  );
  assert.equal(
    isMicrosoftEntraRoutePath("/api/auth/callback/microsoft-entra-id"),
    true
  );
  assert.equal(isMicrosoftEntraRoutePath("/api/auth/session"), false);
});

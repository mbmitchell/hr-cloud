import test from "node:test";
import assert from "node:assert/strict";

import { buildAuthDiagnostics } from "../lib/server/auth-diagnostics";

test("auth diagnostics reports presence-only Entra and dev-auth state", () => {
  const diagnostics = buildAuthDiagnostics({
    AUTH_MICROSOFT_ENTRA_ID_ID: "00000000-0000-0000-0000-000000000000",
    AUTH_MICROSOFT_ENTRA_ID_SECRET: "super-secret",
    AUTH_MICROSOFT_ENTRA_ID_ISSUER:
      "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0",
    AUTH_MICROSOFT_ENTRA_ID_EMAIL_DOMAIN: "managedfinancialnetworks.com",
    NEXTAUTH_URL: "https://hr.internal.example.com",
    AUTH_ENABLE_DEV_AUTH: "false",
    AUTH_ENABLE_DEV_USER_SWITCHER: "false",
    AUTH_DEV_PASSWORD: "do-not-print",
  });

  assert.equal(diagnostics.providers.microsoft365, true);
  assert.equal(diagnostics.providers.devCredentials, false);
  assert.deepEqual(diagnostics.entra.envPresence, {
    clientId: true,
    clientSecret: true,
    issuer: true,
    nextAuthUrl: true,
  });
  assert.equal(
    diagnostics.entra.issuerTenantId,
    "12345678-1234-1234-1234-123456789abc"
  );
  assert.equal(
    diagnostics.entra.callbackUrl,
    "https://hr.internal.example.com/api/auth/callback/microsoft-entra-id"
  );
  assert.equal(diagnostics.entra.clientIdLooksLikeApplicationIdUri, false);
  assert.equal(diagnostics.devAuth.passwordConfigured, true);
});

test("auth diagnostics flags api-style client ids and missing values without exposing them", () => {
  const diagnostics = buildAuthDiagnostics({
    AUTH_MICROSOFT_ENTRA_ID_ID: "api://example-app-id-uri",
    AUTH_ENABLE_DEV_AUTH: "true",
  });

  assert.equal(diagnostics.providers.microsoft365, false);
  assert.equal(diagnostics.providers.devCredentials, true);
  assert.deepEqual(diagnostics.entra.envPresence, {
    clientId: true,
    clientSecret: false,
    issuer: false,
    nextAuthUrl: false,
  });
  assert.equal(diagnostics.entra.clientIdLooksLikeApplicationIdUri, true);
  assert.equal(diagnostics.entra.callbackUrl, null);
});

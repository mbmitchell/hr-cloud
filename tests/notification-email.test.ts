import test from "node:test";
import assert from "node:assert/strict";

import {
  getEmailRuntimeConfig,
  resolveEmailTransportKind,
} from "../lib/notifications/email/send-email";

test("email transport defaults to safe dev mode outside production", () => {
  assert.equal(
    resolveEmailTransportKind({
      NODE_ENV: "development",
    }),
    "dev"
  );
});

test("email transport defaults to graph in production", () => {
  assert.equal(
    resolveEmailTransportKind({
      NODE_ENV: "production",
    }),
    "graph"
  );
});

test("email runtime config reads explicit graph settings", () => {
  const config = getEmailRuntimeConfig({
    EMAIL_TRANSPORT: "graph",
    EMAIL_FROM: "hr@managedfinancialnetworks.com",
    EMAIL_REPLY_TO: "benefits@managedfinancialnetworks.com",
    APP_BASE_URL: "https://hr.managedfinancialnetworks.com",
    GRAPH_TENANT_ID: "tenant-id",
    GRAPH_CLIENT_ID: "client-id",
    GRAPH_CLIENT_SECRET: "secret",
    GRAPH_MAILBOX_USER_ID: "hr@managedfinancialnetworks.com",
  });

  assert.deepEqual(config, {
    transport: "graph",
    from: "hr@managedfinancialnetworks.com",
    replyTo: "benefits@managedfinancialnetworks.com",
    appBaseUrl: "https://hr.managedfinancialnetworks.com",
    graphTenantId: "tenant-id",
    graphClientId: "client-id",
    graphClientSecret: "secret",
    graphMailboxUserId: "hr@managedfinancialnetworks.com",
  });
});

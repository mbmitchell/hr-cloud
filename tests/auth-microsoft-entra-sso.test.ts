import test from "node:test";
import assert from "node:assert/strict";

import {
  authorizeMicrosoftEntraSignIn,
  extractEmailCandidates,
  extractMicrosoftEntraClaims,
  extractOid,
  extractTid,
  getConfiguredTenantIdFromIssuer,
  isAllowedEmailDomain,
} from "../lib/auth/microsoft-entra-sso";

test("configured tenant id is extracted from issuer", () => {
  assert.equal(
    getConfiguredTenantIdFromIssuer(
      "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0"
    ),
    "12345678-1234-1234-1234-123456789abc"
  );
  assert.equal(
    getConfiguredTenantIdFromIssuer(
      "https://login.microsoftonline.com/common/v2.0"
    ),
    null
  );
});

test("oid and tid claims are extracted safely", () => {
  const profile = {
    oid: "oid-123",
    tid: "tid-456",
  };

  assert.equal(extractOid({ profile }), "oid-123");
  assert.equal(extractTid({ profile }), "tid-456");
  assert.deepEqual(extractMicrosoftEntraClaims({ user: {}, profile }), {
    oid: "oid-123",
    tid: "tid-456",
    emailCandidates: [],
    displayName: null,
  });
});

test("email candidates are normalized and deduplicated", () => {
  assert.deepEqual(
    extractEmailCandidates({
      user: { email: " USER@Example.com " },
      profile: {
        preferred_username: "user@example.com",
        upn: "USER@example.com",
      },
    }),
    ["user@example.com"]
  );
});

test("email domain validation requires the configured company domain", () => {
  assert.equal(
    isAllowedEmailDomain("employee@managedfinancialnetworks.com", "managedfinancialnetworks.com"),
    true
  );
  assert.equal(
    isAllowedEmailDomain("employee@external.com", "managedfinancialnetworks.com"),
    false
  );
});

test("entra sign-in requires matching tenant and matching employee record", async () => {
  const resolveEmployeeByEntraIdentity = async ({
    entraOid,
    entraTid,
  }: {
    entraOid: string;
    entraTid: string;
  }) => {
    if (
      entraOid === "oid-123" &&
      entraTid === "12345678-1234-1234-1234-123456789abc"
    ) {
      return {
        id: "emp-1",
        email: "employee@managedfinancialnetworks.com",
        status: "ACTIVE",
        entraOid,
        entraTid,
        firstName: "Taylor",
        lastName: "Jordan",
      };
    }

    return null;
  };

  const resolveEmployeeByEmail = async (email: string) => {
    if (email === "employee@managedfinancialnetworks.com") {
      return {
        id: "emp-1",
        email: "employee@managedfinancialnetworks.com",
        status: "ACTIVE",
        entraOid: null,
        entraTid: null,
        firstName: "Taylor",
        lastName: "Jordan",
      };
    }

    return null;
  };

  const bindEmployeeToEntraIdentity = async ({
    employeeId,
    entraOid,
    entraTid,
  }: {
    employeeId: string;
    entraOid: string;
    entraTid: string;
  }) => ({
    id: employeeId,
    email: "employee@managedfinancialnetworks.com",
    status: "ACTIVE",
    entraOid,
    entraTid,
    firstName: "Taylor",
    lastName: "Jordan",
  });

  const allowedUser = await authorizeMicrosoftEntraSignIn({
    user: { email: "employee@managedfinancialnetworks.com", name: "Taylor Jordan" },
    profile: {
      oid: "oid-123",
      tid: "12345678-1234-1234-1234-123456789abc",
      preferred_username: "employee@managedfinancialnetworks.com",
      name: "Taylor Jordan",
    },
    issuer:
      "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0",
    allowedEmailDomain: "managedfinancialnetworks.com",
    resolveEmployeeByEntraIdentity,
    resolveEmployeeByEmail,
    bindEmployeeToEntraIdentity,
  });

  assert.equal(allowedUser.ok, true);
  if (allowedUser.ok) {
    assert.deepEqual(allowedUser.authenticatedUser, {
      employeeId: "emp-1",
      email: "employee@managedfinancialnetworks.com",
      name: "Taylor Jordan",
      oid: "oid-123",
      tid: "12345678-1234-1234-1234-123456789abc",
    });
    assert.equal(allowedUser.matchedBy, "entra_identity");
    assert.equal(allowedUser.bindingCreated, false);
  }

  const deniedUser = await authorizeMicrosoftEntraSignIn({
    user: { email: "employee@managedfinancialnetworks.com" },
    profile: {
      tid: "wrong-tenant",
      preferred_username: "employee@managedfinancialnetworks.com",
    },
    issuer:
      "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0",
    allowedEmailDomain: "managedfinancialnetworks.com",
    resolveEmployeeByEntraIdentity,
    resolveEmployeeByEmail,
    bindEmployeeToEntraIdentity,
  });

  assert.deepEqual(deniedUser, {
    ok: false,
    reason: "tenant_mismatch",
    claims: {
      oid: null,
      tid: "wrong-tenant",
      emailCandidates: ["employee@managedfinancialnetworks.com"],
      displayName: null,
    },
    matchedBy: null,
    bindingCreated: false,
  });
});

test("entra sign-in bootstraps identity binding from email when no oid/tid mapping exists yet", async () => {
  let boundIdentity: { employeeId: string; entraOid: string; entraTid: string } | null = null;

  const result = await authorizeMicrosoftEntraSignIn({
    user: { email: "employee@managedfinancialnetworks.com" },
    profile: {
      oid: "oid-bootstrap",
      tid: "12345678-1234-1234-1234-123456789abc",
      preferred_username: "employee@managedfinancialnetworks.com",
    },
    issuer:
      "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0",
    allowedEmailDomain: "managedfinancialnetworks.com",
    resolveEmployeeByEntraIdentity: async () => null,
    resolveEmployeeByEmail: async (email: string) =>
      email === "employee@managedfinancialnetworks.com"
        ? {
            id: "emp-2",
            email,
            status: "ACTIVE",
            entraOid: null,
            entraTid: null,
            firstName: "Alex",
            lastName: "Employee",
          }
        : null,
    bindEmployeeToEntraIdentity: async (input) => {
      boundIdentity = input;
      return {
        id: input.employeeId,
        email: "employee@managedfinancialnetworks.com",
        status: "ACTIVE",
        entraOid: input.entraOid,
        entraTid: input.entraTid,
        firstName: "Alex",
        lastName: "Employee",
      };
    },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.matchedBy, "email_fallback");
    assert.equal(result.bindingCreated, true);
    assert.deepEqual(boundIdentity, {
      employeeId: "emp-2",
      entraOid: "oid-bootstrap",
      entraTid: "12345678-1234-1234-1234-123456789abc",
    });
  }
});

test("entra sign-in refuses email fallback when employee is already bound to another identity", async () => {
  const result = await authorizeMicrosoftEntraSignIn({
    user: { email: "employee@managedfinancialnetworks.com" },
    profile: {
      oid: "oid-new",
      tid: "12345678-1234-1234-1234-123456789abc",
      preferred_username: "employee@managedfinancialnetworks.com",
    },
    issuer:
      "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0",
    allowedEmailDomain: "managedfinancialnetworks.com",
    resolveEmployeeByEntraIdentity: async () => null,
    resolveEmployeeByEmail: async () => ({
      id: "emp-3",
      email: "employee@managedfinancialnetworks.com",
      status: "ACTIVE",
      entraOid: "oid-existing",
      entraTid: "12345678-1234-1234-1234-123456789abc",
      firstName: "Morgan",
      lastName: "Employee",
    }),
    bindEmployeeToEntraIdentity: async () => {
      throw new Error("Should not bind conflicting identity.");
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "identity_conflict");
  }
});

test("entra sign-in denies inactive employees even when identity matches", async () => {
  const result = await authorizeMicrosoftEntraSignIn({
    user: { email: "inactive@managedfinancialnetworks.com" },
    profile: {
      oid: "oid-inactive",
      tid: "12345678-1234-1234-1234-123456789abc",
      preferred_username: "inactive@managedfinancialnetworks.com",
    },
    issuer:
      "https://login.microsoftonline.com/12345678-1234-1234-1234-123456789abc/v2.0",
    allowedEmailDomain: "managedfinancialnetworks.com",
    resolveEmployeeByEntraIdentity: async () => ({
      id: "emp-inactive",
      email: "inactive@managedfinancialnetworks.com",
      status: "INACTIVE",
      entraOid: "oid-inactive",
      entraTid: "12345678-1234-1234-1234-123456789abc",
      firstName: "Inactive",
      lastName: "Employee",
    }),
    resolveEmployeeByEmail: async () => null,
    bindEmployeeToEntraIdentity: async () => {
      throw new Error("Should not bind inactive employee.");
    },
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.reason, "inactive_employee");
  }
});

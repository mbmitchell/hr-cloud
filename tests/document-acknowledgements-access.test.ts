import test from "node:test";
import assert from "node:assert/strict";

import {
  canManageDocumentAcknowledgements,
} from "../lib/server/document-acknowledgements/access";

test("documents admin role can manage document acknowledgements without HR admin", () => {
  const actor = {
    id: "emp-1",
    roles: ["DOCUMENTS_ADMIN"],
    permissions: [],
  };

  assert.equal(canManageDocumentAcknowledgements(actor as never), true);
});

test("compensation-only style roles do not gain document acknowledgement access", () => {
  const actor = {
    id: "emp-2",
    roles: ["ACCOUNTING"],
    permissions: [],
  };

  assert.equal(canManageDocumentAcknowledgements(actor as never), false);
});

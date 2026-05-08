import test from "node:test";
import assert from "node:assert/strict";

import { applyApprovalDecision } from "../lib/pto/apply-approval-decision";

function createApprovalTx(options?: {
  duplicateLedgerEntry?: { id: string } | null;
  latestLedgerBalance?: number | null;
}) {
  const state = {
    ptoRequestUpdateManyArgs: null as unknown,
    ptoRequestActionCreates: [] as unknown[],
    ledgerCreates: [] as unknown[],
    auditCreates: [] as unknown[],
  };

  const tx = {
    pTORequest: {
      async updateMany(args: unknown) {
        state.ptoRequestUpdateManyArgs = args;
        return { count: 1 };
      },
      async findUnique() {
        return {
          id: "req-1",
          employeeId: "emp-1",
          leaveType: "PTO",
          hours: 8,
          status: "APPROVED",
          approvalComment: "Looks good",
        };
      },
    },
    pTORequestAction: {
      async create(args: unknown) {
        state.ptoRequestActionCreates.push(args);
        return args;
      },
    },
    pTOLedger: {
      async findUnique() {
        return options?.duplicateLedgerEntry ?? null;
      },
      async findFirst() {
        if (options?.latestLedgerBalance == null) {
          return null;
        }

        return { balance: options.latestLedgerBalance };
      },
      async create(args: unknown) {
        state.ledgerCreates.push(args);
        return { id: "ledger-1" };
      },
    },
    auditLog: {
      async create(args: unknown) {
        state.auditCreates.push(args);
        return args;
      },
    },
  };

  return { tx, state };
}

test("approved PTO request writes both ledger and audit records", async () => {
  const { tx, state } = createApprovalTx({ latestLedgerBalance: 40 });

  await applyApprovalDecision(tx, {
    requestId: "req-1",
    status: "APPROVED",
    approvalComment: "Looks good",
    actorId: "mgr-1",
    existingRequest: {
      id: "req-1",
      employeeId: "emp-1",
      leaveType: "PTO",
      hours: 8,
      status: "PENDING",
      approvalComment: null,
    },
  });

  assert.equal(state.ledgerCreates.length, 1);
  assert.equal(state.auditCreates.length, 1);

  const ledgerCreate = state.ledgerCreates[0] as {
    data: { sourceRequestId: string; idempotencyKey: string; balance: number };
  };

  assert.equal(ledgerCreate.data.sourceRequestId, "req-1");
  assert.equal(ledgerCreate.data.idempotencyKey, "request-approval:req-1");
  assert.equal(ledgerCreate.data.balance, 32);
});

test("denied PTO request writes audit but does not post a ledger row", async () => {
  const { tx, state } = createApprovalTx({ latestLedgerBalance: 40 });

  await applyApprovalDecision(tx, {
    requestId: "req-1",
    status: "DENIED",
    approvalComment: "Insufficient staffing",
    actorId: "mgr-1",
    existingRequest: {
      id: "req-1",
      employeeId: "emp-1",
      leaveType: "PTO",
      hours: 8,
      status: "PENDING",
      approvalComment: null,
    },
  });

  assert.equal(state.ledgerCreates.length, 0);
  assert.equal(state.auditCreates.length, 1);
});

test("duplicate approval posting is rejected before another ledger write", async () => {
  const { tx, state } = createApprovalTx({
    duplicateLedgerEntry: { id: "ledger-existing" },
  });

  await assert.rejects(
    () =>
      applyApprovalDecision(tx, {
        requestId: "req-1",
        status: "APPROVED",
        approvalComment: null,
        actorId: "mgr-1",
        existingRequest: {
          id: "req-1",
          employeeId: "emp-1",
          leaveType: "PTO",
          hours: 8,
          status: "PENDING",
          approvalComment: null,
        },
      }),
    /Approval has already been posted to the PTO ledger\./
  );

  assert.equal(state.ledgerCreates.length, 0);
  assert.equal(state.auditCreates.length, 0);
});

test("approved bereavement request writes audit without posting a ledger row", async () => {
  const { tx, state } = createApprovalTx({ latestLedgerBalance: 40 });

  await applyApprovalDecision(tx, {
    requestId: "req-1",
    status: "APPROVED",
    approvalComment: "Approved bereavement leave",
    actorId: "mgr-1",
    existingRequest: {
      id: "req-1",
      employeeId: "emp-1",
      leaveType: "BEREAVEMENT",
      hours: 24,
      status: "PENDING",
      approvalComment: null,
    },
  });

  assert.equal(state.ledgerCreates.length, 0);
  assert.equal(state.auditCreates.length, 1);

  const auditCreate = state.auditCreates[0] as {
    data: { action: string; newValue: string };
  };

  assert.equal(auditCreate.data.action, "REQUEST_APPROVED");

  const newValue = JSON.parse(auditCreate.data.newValue);
  assert.equal(newValue.ledgerEntryId, null);
  assert.equal(newValue.workflowOnly, true);
});

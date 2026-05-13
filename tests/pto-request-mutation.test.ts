import test from "node:test";
import assert from "node:assert/strict";

import { mutatePtoRequest } from "../lib/pto/mutate-request";

function createMutationTx(options?: {
  existingSourceLedgerEntry?: { id: string } | null;
  initialBalances?: Partial<Record<"PTO" | "COMP", number>>;
}) {
  const state = {
    requestUpdates: [] as Array<{ where: unknown; data: Record<string, unknown> }>,
    requestActionCreates: [] as unknown[],
    ledgerCreates: [] as Array<{ data: Record<string, unknown> }>,
    auditCreates: [] as unknown[],
    balances: {
      PTO: options?.initialBalances?.PTO ?? 0,
      COMP: options?.initialBalances?.COMP ?? 0,
    },
  };

  const tx = {
    pTORequest: {
      async update(args: { where: unknown; data: Record<string, unknown> }) {
        state.requestUpdates.push(args);
        return {
          id: "req-1",
          employeeId: "emp-1",
          leaveType: String(args.data.leaveType),
          startDate: args.data.startDate as Date,
          endDate: args.data.endDate as Date,
          hours: Number(args.data.hours),
          status: String(args.data.status),
          approverId:
            args.data.approverId == null ? null : String(args.data.approverId),
          notes: (args.data.notes as string | null | undefined) ?? null,
          approvalComment:
            (args.data.approvalComment as string | null | undefined) ?? null,
          decisionAt: (args.data.decisionAt as Date | null | undefined) ?? null,
          decidedBy:
            args.data.decidedBy == null ? null : String(args.data.decidedBy),
        };
      },
    },
    pTORequestAction: {
      async create(args: unknown) {
        state.requestActionCreates.push(args);
        return args;
      },
    },
    pTOLedger: {
      async findUnique() {
        return options?.existingSourceLedgerEntry ?? null;
      },
      async findFirst(args: { where: { bucket: "PTO" | "COMP" } }) {
        return {
          balance: state.balances[args.where.bucket],
        };
      },
      async create(args: { data: Record<string, unknown> }) {
        state.ledgerCreates.push(args);
        const bucket = args.data.bucket as "PTO" | "COMP";
        state.balances[bucket] = Number(args.data.balance);
        return { id: `ledger-${state.ledgerCreates.length}` };
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

test("editing an approved tracked request reverses the old deduction and reapplies the new one", async () => {
  const { tx, state } = createMutationTx({
    existingSourceLedgerEntry: { id: "ledger-source" },
    initialBalances: { PTO: 32 },
  });

  const result = await mutatePtoRequest(tx, {
    actorId: "mgr-1",
    existingRequest: {
      id: "req-1",
      employeeId: "emp-1",
      leaveType: "PTO",
      startDate: new Date("2026-05-12T12:00:00Z"),
      endDate: new Date("2026-05-13T12:00:00Z"),
      hours: 8,
      status: "APPROVED",
      approverId: "mgr-1",
      notes: "Original",
      approvalComment: "Approved",
      decisionAt: new Date("2026-05-01T12:00:00Z"),
      decidedBy: "mgr-1",
    },
    nextValues: {
      leaveType: "PTO",
      startDate: new Date("2026-05-12T12:00:00Z"),
      endDate: new Date("2026-05-12T12:00:00Z"),
      hours: 4,
      status: "APPROVED",
      notes: "Updated",
      approvalComment: "Adjusted",
    },
  });

  assert.equal(result.ledgerAdjusted, true);
  assert.equal(state.ledgerCreates.length, 2);

  const reversal = state.ledgerCreates[0];
  const reapplied = state.ledgerCreates[1];

  assert.equal(reversal.data.type, "MANUAL_ADD");
  assert.equal(reversal.data.hours, 8);
  assert.equal(reapplied.data.type, "MANUAL_SUBTRACT");
  assert.equal(reapplied.data.hours, -4);

  const requestActionCreate = state.requestActionCreates[0] as {
    data: { action: string };
  };
  assert.equal(requestActionCreate.data.action, "UPDATED");
});

test("cancelling an approved tracked request posts a soft-cancel reversal", async () => {
  const { tx, state } = createMutationTx({
    existingSourceLedgerEntry: { id: "ledger-source" },
    initialBalances: { PTO: 24 },
  });

  const result = await mutatePtoRequest(tx, {
    actorId: "hr-1",
    existingRequest: {
      id: "req-1",
      employeeId: "emp-1",
      leaveType: "PTO",
      startDate: new Date("2026-05-12T12:00:00Z"),
      endDate: new Date("2026-05-12T12:00:00Z"),
      hours: 8,
      status: "APPROVED",
      approverId: "mgr-1",
      notes: "Original",
      approvalComment: "Approved",
      decisionAt: new Date("2026-05-01T12:00:00Z"),
      decidedBy: "mgr-1",
    },
    nextValues: {
      leaveType: "PTO",
      startDate: new Date("2026-05-12T12:00:00Z"),
      endDate: new Date("2026-05-12T12:00:00Z"),
      hours: 8,
      status: "CANCELLED",
      notes: "Original",
      approvalComment: "Cancelled by HR",
    },
  });

  assert.equal(result.newStatus, "CANCELLED");
  assert.equal(state.ledgerCreates.length, 1);
  assert.equal(state.ledgerCreates[0].data.type, "MANUAL_ADD");
  assert.equal(state.ledgerCreates[0].data.hours, 8);

  const requestActionCreate = state.requestActionCreates[0] as {
    data: { action: string };
  };
  assert.equal(requestActionCreate.data.action, "CANCELLED");
});

test("approving a pending request for the first time creates the linked usage row", async () => {
  const { tx, state } = createMutationTx({
    existingSourceLedgerEntry: null,
    initialBalances: { PTO: 40 },
  });

  const result = await mutatePtoRequest(tx, {
    actorId: "mgr-1",
    existingRequest: {
      id: "req-1",
      employeeId: "emp-1",
      leaveType: "PTO",
      startDate: new Date("2026-05-12T12:00:00Z"),
      endDate: new Date("2026-05-12T12:00:00Z"),
      hours: 8,
      status: "PENDING",
      approverId: null,
      notes: "Original",
      approvalComment: null,
      decisionAt: null,
      decidedBy: null,
    },
    nextValues: {
      leaveType: "PTO",
      startDate: new Date("2026-05-12T12:00:00Z"),
      endDate: new Date("2026-05-12T12:00:00Z"),
      hours: 8,
      status: "APPROVED",
      notes: "Original",
      approvalComment: "Approved",
    },
  });

  assert.equal(result.newStatus, "APPROVED");
  assert.equal(state.ledgerCreates.length, 1);
  assert.equal(state.ledgerCreates[0].data.type, "USAGE");
  assert.equal(state.ledgerCreates[0].data.sourceRequestId, "req-1");
  assert.equal(state.ledgerCreates[0].data.idempotencyKey, "request-approval:req-1");
});

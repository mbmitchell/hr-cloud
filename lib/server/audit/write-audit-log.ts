/**
 * Audit Log Writer
 *
 * Minimal shared helper for writing structured audit rows from both routes and
 * transactional service helpers.
 *
 * Responsibilities:
 * - Normalize before/after payload serialization
 * - Keep audit writes consistent across Prisma client and transaction clients
 *
 * Security considerations:
 * - Audit payloads should contain safe business context only
 * - Callers should avoid storing secrets, tokens, or raw provider payloads
 */
type AuditLogClient = {
  auditLog: {
    create(args: {
      data: {
        userId: string;
        action: string;
        entityType: string;
        entityId: string;
        oldValue: string | null;
        newValue: string | null;
      };
    }): Promise<unknown>;
  };
};

type AuditLogInput = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function writeAuditLog(
  tx: AuditLogClient,
  input: AuditLogInput
) {
  await tx.auditLog.create({
    data: {
      userId: input.userId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      oldValue:
        input.oldValue === undefined ? null : JSON.stringify(input.oldValue),
      newValue:
        input.newValue === undefined ? null : JSON.stringify(input.newValue),
    },
  });
}

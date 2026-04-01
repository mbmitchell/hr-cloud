import type { Prisma } from "@prisma/client";

type AuditLogInput = {
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  oldValue?: unknown;
  newValue?: unknown;
};

export async function writeAuditLog(
  tx: Prisma.TransactionClient,
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

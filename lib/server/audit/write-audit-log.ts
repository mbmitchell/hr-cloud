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

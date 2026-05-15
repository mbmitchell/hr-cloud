import { prisma } from "../db";
import { writeAuditLog } from "../server/audit/write-audit-log";
import { normalizeEmail } from "./microsoft-entra-sso";

type IdentityLinkageInput = {
  employeeId: string;
  email: string;
  name?: string | null;
  provider?: string | null;
  providerAccountId?: string | null;
};

type IdentityLinkageOutcome =
  | {
      status: "noop";
    }
  | {
      status: "applied";
      userId: string;
      createdUser: boolean;
      linkedEmployee: boolean;
      createdIdentity: boolean;
    }
  | {
      status: "conflict";
      userId: string;
      reason: string;
    }
  | {
      status: "failed";
      reason: string;
    };

function normalizeProvider(value: string | null | undefined) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || null;
}

function normalizeProviderAccountId(value: string | null | undefined) {
  const normalizedValue = String(value || "").trim();
  return normalizedValue || null;
}

function getAuditActorId(input: IdentityLinkageInput) {
  return input.employeeId.trim() || `auth:${normalizeProvider(input.provider) || "unknown"}`;
}

async function writeIdentityLinkageAuditLog(input: {
  action: string;
  actorId: string;
  entityType: string;
  entityId: string;
  payload: Record<string, unknown>;
}) {
  try {
    await writeAuditLog(prisma, {
      userId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      newValue: input.payload,
    });
  } catch (error) {
    console.warn(
      "[auth-linkage] Failed to write audit log",
      error instanceof Error ? error.message : error
    );
  }
}

/**
 * Best-effort platform identity linkage that preserves the current
 * Employee-centric auth model.
 *
 * This helper never throws to the caller. Login must continue even if user or
 * identity linkage fails, because auth/session behavior is intentionally
 * unchanged in this scaffolding phase.
 */
export async function linkAuthenticatedIdentity(
  input: IdentityLinkageInput
): Promise<IdentityLinkageOutcome> {
  const employeeId = String(input.employeeId || "").trim();
  const normalizedEmail = normalizeEmail(input.email);
  const normalizedProvider = normalizeProvider(input.provider);
  const normalizedProviderAccountId = normalizeProviderAccountId(
    input.providerAccountId
  );
  const actorId = getAuditActorId(input);

  if (!employeeId || !normalizedEmail) {
    return { status: "noop" };
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      let user = await tx.user.findUnique({
        where: { email: normalizedEmail },
        select: { id: true, email: true },
      });
      let createdUser = false;

      if (!user) {
        user = await tx.user.create({
          data: {
            email: normalizedEmail,
            displayName: String(input.name || "").trim() || null,
          },
          select: { id: true, email: true },
        });
        createdUser = true;
      }

      const employee = await tx.employee.findUnique({
        where: { id: employeeId },
        select: {
          id: true,
          email: true,
          userId: true,
        },
      });

      if (!employee) {
        return {
          status: "failed" as const,
          reason: "employee_not_found",
        };
      }

      if (employee.userId && employee.userId !== user.id) {
        return {
          status: "conflict" as const,
          userId: user.id,
          reason: "employee_already_linked_to_different_user",
        };
      }

      let linkedEmployee = false;

      if (!employee.userId) {
        await tx.employee.update({
          where: { id: employee.id },
          data: {
            userId: user.id,
          },
        });
        linkedEmployee = true;
      }

      let createdIdentity = false;

      if (normalizedProvider && normalizedProviderAccountId) {
        const existingIdentity = await tx.userIdentity.findUnique({
          where: {
            provider_providerAccountId: {
              provider: normalizedProvider,
              providerAccountId: normalizedProviderAccountId,
            },
          },
          select: {
            id: true,
            userId: true,
          },
        });

        if (existingIdentity && existingIdentity.userId !== user.id) {
          return {
            status: "conflict" as const,
            userId: user.id,
            reason: "provider_identity_already_linked_to_different_user",
          };
        }

        if (!existingIdentity) {
          await tx.userIdentity.create({
            data: {
              userId: user.id,
              provider: normalizedProvider,
              providerAccountId: normalizedProviderAccountId,
              email: normalizedEmail,
            },
          });
          createdIdentity = true;
        }
      }

      if (!createdUser && !linkedEmployee && !createdIdentity) {
        return {
          status: "noop" as const,
        };
      }

      return {
        status: "applied" as const,
        userId: user.id,
        createdUser,
        linkedEmployee,
        createdIdentity,
      };
    });

    if (result.status === "applied") {
      const payload = {
        normalizedEmail,
        provider: normalizedProvider,
        createdUser: result.createdUser,
        linkedEmployee: result.linkedEmployee,
        createdIdentity: result.createdIdentity,
      };

      await writeIdentityLinkageAuditLog({
        action: "AUTH_IDENTITY_LINKAGE_APPLIED",
        actorId,
        entityType: "Employee",
        entityId: employeeId,
        payload,
      });

      console.info(JSON.stringify({
        eventType: "AUTH_IDENTITY_LINKAGE_APPLIED",
        employeeId,
        userId: result.userId,
        ...payload,
      }));
    } else if (result.status === "conflict") {
      const payload = {
        normalizedEmail,
        provider: normalizedProvider,
        userId: result.userId,
        reason: result.reason,
      };

      await writeIdentityLinkageAuditLog({
        action: "AUTH_IDENTITY_LINKAGE_CONFLICT",
        actorId,
        entityType: "Employee",
        entityId: employeeId,
        payload,
      });

      console.warn(JSON.stringify({
        eventType: "AUTH_IDENTITY_LINKAGE_CONFLICT",
        employeeId,
        ...payload,
      }));
    } else if (result.status === "failed") {
      const payload = {
        normalizedEmail,
        provider: normalizedProvider,
        reason: result.reason,
      };

      await writeIdentityLinkageAuditLog({
        action: "AUTH_IDENTITY_LINKAGE_FAILED",
        actorId,
        entityType: "Employee",
        entityId: employeeId,
        payload,
      });

      console.warn(JSON.stringify({
        eventType: "AUTH_IDENTITY_LINKAGE_FAILED",
        employeeId,
        ...payload,
      }));
    }

    return result;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "unknown_linkage_error";

    await writeIdentityLinkageAuditLog({
      action: "AUTH_IDENTITY_LINKAGE_FAILED",
      actorId,
      entityType: "Employee",
      entityId: employeeId,
      payload: {
        normalizedEmail,
        provider: normalizedProvider,
        reason: message,
      },
    });

    console.warn(JSON.stringify({
      eventType: "AUTH_IDENTITY_LINKAGE_FAILED",
      employeeId,
      normalizedEmail,
      provider: normalizedProvider,
      reason: message,
    }));

    return {
      status: "failed",
      reason: message,
    };
  }
}

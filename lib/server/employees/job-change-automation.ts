import { Prisma } from "@prisma/client";

import { prisma } from "../../db";
import { writeAuditLog } from "../audit/write-audit-log";
import { applyApprovedEmployeeChangeRequest } from "./change-requests";
import { enqueueJobChangeNotifications } from "../hr-notifications/job-changes";
import { enqueuePtoEscalationNotifications } from "../hr-notifications/pto";
import { auditEscalationTriggered } from "../hr-notifications/audit";

function startOfLocalDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function endOfLocalDay(date = new Date()) {
  const value = startOfLocalDay(date);
  value.setDate(value.getDate() + 1);
  return value;
}

function summarizeError(error: unknown) {
  const summary =
    error instanceof Error
      ? `${error.name}: ${error.message}`
      : "Unknown job change automation error.";

  return summary.slice(0, 1000);
}

export function getJobChangeAutomationConfig(
  env: Record<string, string | undefined> = process.env
) {
  const autoApplyEnabledRaw = env.JOB_CHANGE_AUTO_APPLY_ENABLED?.trim();
  const pendingEscalationDaysRaw = Number(
    env.JOB_CHANGE_PENDING_ESCALATION_DAYS ?? "3"
  );
  const ptoEscalationHoursRaw = Number(
    env.PTO_PENDING_ESCALATION_HOURS ?? "48"
  );

  return {
    autoApplyEnabled:
      autoApplyEnabledRaw == null
        ? true
        : autoApplyEnabledRaw.toLowerCase() === "true",
    pendingEscalationDays:
      Number.isFinite(pendingEscalationDaysRaw) && pendingEscalationDaysRaw >= 0
        ? Math.floor(pendingEscalationDaysRaw)
        : 3,
    ptoPendingEscalationHours:
      Number.isFinite(ptoEscalationHoursRaw) && ptoEscalationHoursRaw >= 1
        ? Math.floor(ptoEscalationHoursRaw)
        : 48,
  };
}

async function hasEscalationForToday(input: {
  eventType: string;
  relatedEntityType: "EmployeeChangeRequest" | "PTORequest";
  relatedEntityId: string;
  now: Date;
}) {
  const existing = await prisma.hrNotificationOutbox.findFirst({
    where: {
      eventType: input.eventType,
      relatedEntityType: input.relatedEntityType,
      relatedEntityId: input.relatedEntityId,
      notificationType: "SYSTEM_GENERATED",
      createdAt: {
        gte: startOfLocalDay(input.now),
        lt: endOfLocalDay(input.now),
      },
    },
    select: {
      id: true,
    },
  });

  return Boolean(existing);
}

export async function autoApplyApprovedJobChanges(input?: {
  actorId?: string;
  now?: Date;
}) {
  const config = getJobChangeAutomationConfig();
  const now = input?.now ?? new Date();
  const actorId = input?.actorId ?? "system:auto-apply";

  if (!config.autoApplyEnabled) {
    return {
      enabled: false,
      scanned: 0,
      applied: 0,
      alreadyApplied: 0,
      failed: 0,
      failures: [] as Array<{ changeId: string; error: string }>,
    };
  }

  const changes = await prisma.employeeChangeRequest.findMany({
    where: {
      status: "APPROVED",
      appliedAt: null,
      actualEffectiveDate: null,
      cancelledAt: null,
      requestedEffectiveDate: {
        lte: now,
      },
    },
    select: {
      id: true,
      employeeId: true,
      requestedEffectiveDate: true,
    },
    orderBy: [{ requestedEffectiveDate: "asc" }, { createdAt: "asc" }],
  });

  let applied = 0;
  let alreadyApplied = 0;
  const failures: Array<{ changeId: string; error: string }> = [];

  for (const change of changes) {
    await writeAuditLog(prisma, {
      userId: actorId,
      action: "EMPLOYEE_CHANGE_REQUEST_AUTO_APPLY_TRIGGERED",
      entityType: "EmployeeChangeRequest",
      entityId: change.id,
      newValue: {
        employeeId: change.employeeId,
        requestedEffectiveDate: change.requestedEffectiveDate.toISOString(),
      },
    });

    try {
      const result = await prisma.$transaction(async (tx) => {
        return applyApprovedEmployeeChangeRequest(tx as typeof tx & {
          employee: {
            findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
            update(args: {
              where: { id: string };
              data: Record<string, unknown>;
            }): Promise<unknown>;
          };
          employeeChangeRequest: {
            findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
            update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
          };
          employeeStatusHistory: {
            create(args: Record<string, unknown>): Promise<unknown>;
          };
          employeeCompensationProfile: {
            upsert(args: {
              where: { employeeId: string };
              update: Record<string, unknown>;
              create: Record<string, unknown>;
            }): Promise<unknown>;
          };
        }, {
          changeId: change.id,
          appliedAt: now,
          appliedByEmployeeId: null,
        });
      }, {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      });

      if (result.outcome === "already-applied") {
        alreadyApplied += 1;
        continue;
      }

      applied += 1;

      await writeAuditLog(prisma, {
        userId: actorId,
        action: "EMPLOYEE_CHANGE_REQUEST_AUTO_APPLY_SUCCESS",
        entityType: "EmployeeChangeRequest",
        entityId: change.id,
        newValue: {
          employeeId: change.employeeId,
          appliedAt: now.toISOString(),
        },
      });

      try {
        await enqueueJobChangeNotifications({
          eventType: "EMPLOYEE_CHANGE_REQUEST_AUTO_APPLIED",
          changeRequestId: change.id,
          actorId,
          notificationType: "SYSTEM_GENERATED",
        });
      } catch (notificationError) {
        console.error(
          "Failed to enqueue auto-applied job change notifications:",
          notificationError
        );
      }
    } catch (error) {
      const errorSummary = summarizeError(error);
      failures.push({
        changeId: change.id,
        error: errorSummary,
      });

      await writeAuditLog(prisma, {
        userId: actorId,
        action: "EMPLOYEE_CHANGE_REQUEST_AUTO_APPLY_FAILURE",
        entityType: "EmployeeChangeRequest",
        entityId: change.id,
        newValue: {
          employeeId: change.employeeId,
          error: errorSummary,
        },
      });
    }
  }

  return {
    enabled: true,
    scanned: changes.length,
    applied,
    alreadyApplied,
    failed: failures.length,
    failures,
  };
}

export async function enqueueJobChangeEscalations(input?: {
  actorId?: string;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const actorId = input?.actorId ?? "system:notifications";
  const config = getJobChangeAutomationConfig();
  const pendingThreshold = new Date(now);
  pendingThreshold.setDate(
    pendingThreshold.getDate() - config.pendingEscalationDays
  );

  const [pendingChanges, overdueApprovedChanges] = await Promise.all([
    prisma.employeeChangeRequest.findMany({
      where: {
        status: "PENDING",
        submittedAt: {
          lte: pendingThreshold,
        },
      },
      select: {
        id: true,
      },
    }),
    prisma.employeeChangeRequest.findMany({
      where: {
        status: "APPROVED",
        appliedAt: null,
        actualEffectiveDate: null,
        requestedEffectiveDate: {
          lte: now,
        },
      },
      select: {
        id: true,
      },
    }),
  ]);

  let pendingCreated = 0;
  let approvedCreated = 0;

  for (const change of pendingChanges) {
    if (
      await hasEscalationForToday({
        eventType: "EMPLOYEE_CHANGE_REQUEST_PENDING_ESCALATION",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
        now,
      })
    ) {
      continue;
    }

    await enqueueJobChangeNotifications({
      eventType: "EMPLOYEE_CHANGE_REQUEST_PENDING_ESCALATION",
      changeRequestId: change.id,
      actorId,
      notificationType: "SYSTEM_GENERATED",
    });

    const created = await prisma.hrNotificationOutbox.findFirst({
      where: {
        eventType: "EMPLOYEE_CHANGE_REQUEST_PENDING_ESCALATION",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
        notificationType: "SYSTEM_GENERATED",
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
      },
    });

    if (created) {
      pendingCreated += 1;
      await auditEscalationTriggered({
        actorId,
        notificationId: created.id,
        eventType: "EMPLOYEE_CHANGE_REQUEST_PENDING_ESCALATION",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
      });
    }
  }

  for (const change of overdueApprovedChanges) {
    if (
      await hasEscalationForToday({
        eventType: "EMPLOYEE_CHANGE_REQUEST_APPROVED_OVERDUE_ESCALATION",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
        now,
      })
    ) {
      continue;
    }

    await enqueueJobChangeNotifications({
      eventType: "EMPLOYEE_CHANGE_REQUEST_APPROVED_OVERDUE_ESCALATION",
      changeRequestId: change.id,
      actorId,
      notificationType: "SYSTEM_GENERATED",
    });

    const created = await prisma.hrNotificationOutbox.findFirst({
      where: {
        eventType: "EMPLOYEE_CHANGE_REQUEST_APPROVED_OVERDUE_ESCALATION",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
        notificationType: "SYSTEM_GENERATED",
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
      },
    });

    if (created) {
      approvedCreated += 1;
      await auditEscalationTriggered({
        actorId,
        notificationId: created.id,
        eventType: "EMPLOYEE_CHANGE_REQUEST_APPROVED_OVERDUE_ESCALATION",
        relatedEntityType: "EmployeeChangeRequest",
        relatedEntityId: change.id,
      });
    }
  }

  return {
    pendingReviewEscalations: pendingCreated,
    approvedOverdueEscalations: approvedCreated,
  };
}

export async function enqueuePtoEscalations(input?: {
  actorId?: string;
  now?: Date;
}) {
  const now = input?.now ?? new Date();
  const actorId = input?.actorId ?? "system:notifications";
  const config = getJobChangeAutomationConfig();
  const threshold = new Date(
    now.getTime() - config.ptoPendingEscalationHours * 60 * 60 * 1000
  );

  const requests = await prisma.pTORequest.findMany({
    where: {
      status: "PENDING",
      createdAt: {
        lte: threshold,
      },
    },
    select: {
      id: true,
    },
  });

  let created = 0;

  for (const request of requests) {
    if (
      await hasEscalationForToday({
        eventType: "PTO_REQUEST_PENDING_ESCALATION",
        relatedEntityType: "PTORequest",
        relatedEntityId: request.id,
        now,
      })
    ) {
      continue;
    }

    await enqueuePtoEscalationNotifications({
      requestId: request.id,
      actorId,
    });

    const notification = await prisma.hrNotificationOutbox.findFirst({
      where: {
        eventType: "PTO_REQUEST_PENDING_ESCALATION",
        relatedEntityType: "PTORequest",
        relatedEntityId: request.id,
        notificationType: "SYSTEM_GENERATED",
      },
      orderBy: [{ createdAt: "desc" }],
      select: {
        id: true,
      },
    });

    if (notification) {
      created += 1;
      await auditEscalationTriggered({
        actorId,
        notificationId: notification.id,
        eventType: "PTO_REQUEST_PENDING_ESCALATION",
        relatedEntityType: "PTORequest",
        relatedEntityId: request.id,
      });
    }
  }

  return {
    created,
    eligibleRequests: requests.length,
  };
}

export async function listRecentAutoAppliedChanges(limit = 10) {
  const logs = await prisma.auditLog.findMany({
    where: {
      action: "EMPLOYEE_CHANGE_REQUEST_AUTO_APPLY_SUCCESS",
      entityType: "EmployeeChangeRequest",
    },
    orderBy: [{ createdAt: "desc" }],
    take: limit,
    select: {
      entityId: true,
      newValue: true,
      createdAt: true,
    },
  });

  return logs.map((log) => {
    const payload =
      log.newValue && typeof log.newValue === "object"
        ? (log.newValue as Record<string, unknown>)
        : {};

    return {
      changeRequestId: log.entityId,
      employeeId:
        typeof payload.employeeId === "string" ? payload.employeeId : null,
      appliedAt:
        typeof payload.appliedAt === "string"
          ? payload.appliedAt
          : log.createdAt.toISOString(),
    };
  });
}

export async function runHrAutomationBatch(input?: {
  actorId?: string;
  now?: Date;
}) {
  const actorId = input?.actorId ?? "system:automation";
  const now = input?.now ?? new Date();

  const autoApply = await autoApplyApprovedJobChanges({
    actorId,
    now,
  });
  const jobChangeEscalations = await enqueueJobChangeEscalations({
    actorId,
    now,
  });
  const ptoEscalations = await enqueuePtoEscalations({
    actorId,
    now,
  });

  return {
    autoApply,
    escalations: {
      jobChanges: jobChangeEscalations,
      pto: ptoEscalations,
    },
  };
}

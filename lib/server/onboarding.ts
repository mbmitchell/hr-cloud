import { Prisma } from "@prisma/client";
import type {
  EmployeeOnboarding,
  EmployeeOnboardingTask,
  OnboardingTemplate,
  OnboardingTemplateTask,
} from "@prisma/client";

import { prisma } from "../db";
import { getDirectReportIds } from "../auth/access";
import { isManagerOf } from "../auth/permissions";
import { createEmployeeDocumentAssignmentRecord } from "./document-acknowledgements/assign";
import { dispatchDocumentAssignmentNotificationOutboxEntries } from "./document-acknowledgements/notifications";
import {
  type AuthorizationActor,
  AuthorizationError,
  requireActor,
} from "./authorization";
import {
  ONBOARDING_ADMIN_ROLES,
  ONBOARDING_IT_ROLES,
  type OnboardingAssigneeType,
  type OnboardingTaskStatus,
} from "../onboarding/constants";
import { listEmployeeDocumentsForActor } from "./documents/queries";

function hasAnyRole(actor: AuthorizationActor, roleCodes: readonly string[]) {
  return roleCodes.some((roleCode) => actor.roles.includes(roleCode));
}

export function isOnboardingAdmin(actor: AuthorizationActor) {
  return hasAnyRole(actor, ONBOARDING_ADMIN_ROLES);
}

export function isOnboardingItUser(actor: AuthorizationActor) {
  return hasAnyRole(actor, ONBOARDING_IT_ROLES);
}

function addDays(baseDate: Date, days: number) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

export function calculateDueDate(
  startDate: Date,
  dueOffsetDays: number | null
) {
  if (dueOffsetDays == null) {
    return null;
  }

  return addDays(startDate, dueOffsetDays);
}

function assignedEmployeeIdForTask(input: {
  assigneeType: OnboardingAssigneeType;
  employeeId: string;
  managerId: string | null;
}) {
  if (input.assigneeType === "EMPLOYEE") {
    return input.employeeId;
  }

  if (input.assigneeType === "MANAGER") {
    return input.managerId;
  }

  return null;
}

function summarizeTasks(
  tasks: Array<Pick<EmployeeOnboardingTask, "status" | "dueDate">>
) {
  const totalCount = tasks.length;
  const completedCount = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;
  const pendingCount = tasks.filter(
    (task) => task.status !== "COMPLETED" && task.status !== "SKIPPED"
  ).length;

  const dueDates = tasks
    .map((task) => task.dueDate)
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    totalCount,
    completedCount,
    pendingCount,
    nextDueDate: dueDates[0] ?? null,
  };
}

function statusForTasks(tasks: EmployeeOnboardingTask[]): EmployeeOnboarding["status"] {
  if (tasks.length === 0) {
    return "NOT_STARTED";
  }

  const allResolved = tasks.every(
    (task) => task.status === "COMPLETED" || task.status === "SKIPPED"
  );

  if (allResolved) {
    return "COMPLETED";
  }

  return "IN_PROGRESS";
}

export async function requireOnboardingActor() {
  return requireActor();
}

export async function canActorViewOnboarding(
  actor: AuthorizationActor,
  onboarding: {
    employeeId: string;
    tasks: Array<Pick<EmployeeOnboardingTask, "assigneeType">>;
  }
) {
  if (isOnboardingAdmin(actor)) {
    return true;
  }

  if (actor.id === onboarding.employeeId) {
    return true;
  }

  if (await isManagerOf(actor.id, onboarding.employeeId)) {
    return true;
  }

  if (
    isOnboardingItUser(actor) &&
    onboarding.tasks.some((task) => task.assigneeType === "IT")
  ) {
    return true;
  }

  return false;
}

function canActorSeeAllOnboardingTasks(
  actor: AuthorizationActor,
  onboardingEmployeeId: string
) {
  return isOnboardingAdmin(actor) || actor.id === onboardingEmployeeId;
}

function getVisibleOnboardingTasksForActor<T extends { assigneeType: string }>(
  actor: AuthorizationActor,
  onboardingEmployeeId: string,
  tasks: T[]
) {
  if (canActorSeeAllOnboardingTasks(actor, onboardingEmployeeId)) {
    return tasks;
  }

  return tasks.filter((task) => task.assigneeType === "IT");
}

export async function canActorUpdateOnboardingTask(
  actor: AuthorizationActor,
  onboardingEmployeeId: string,
  task: Pick<EmployeeOnboardingTask, "assigneeType">
) {
  if (isOnboardingAdmin(actor)) {
    return true;
  }

  if (task.assigneeType === "EMPLOYEE" && actor.id === onboardingEmployeeId) {
    return true;
  }

  if (
    task.assigneeType === "MANAGER" &&
    (await isManagerOf(actor.id, onboardingEmployeeId))
  ) {
    return true;
  }

  if (task.assigneeType === "IT" && isOnboardingItUser(actor)) {
    return true;
  }

  return false;
}

export async function listVisibleOnboardings(actor: AuthorizationActor) {
  const directReportIds = hasAnyRole(actor, ["MANAGER"])
    ? await getDirectReportIds(actor.id)
    : [];

  const onboardings = await prisma.employeeOnboarding.findMany({
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: true,
          title: true,
        },
      },
      template: {
        select: {
          id: true,
          name: true,
        },
      },
      tasks: {
        include: {
          documentRequirements: {
            orderBy: [{ createdAt: "asc" }],
            include: {
              linkedEmployeeDocument: {
                select: {
                  id: true,
                  originalFileName: true,
                  category: true,
                  status: true,
                },
              },
            },
          },
          acknowledgementRequirements: {
            orderBy: [{ createdAt: "asc" }],
            include: {
              assignableDocument: {
                select: {
                  id: true,
                  title: true,
                  category: true,
                },
              },
              assignedDocumentVersion: {
                select: {
                  id: true,
                  versionLabel: true,
                  publishedAt: true,
                },
              },
              employeeDocumentAssignment: {
                select: {
                  id: true,
                  status: true,
                  assignedAt: true,
                  dueDate: true,
                  acknowledgedAt: true,
                },
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  const visible = onboardings.filter((onboarding) => {
    if (isOnboardingAdmin(actor)) {
      return true;
    }

    if (onboarding.employeeId === actor.id) {
      return true;
    }

    if (directReportIds.includes(onboarding.employeeId)) {
      return true;
    }

    return (
      isOnboardingItUser(actor) &&
      onboarding.tasks.some((task) => task.assigneeType === "IT")
    );
  });

  return visible.map((onboarding) => {
    const visibleTasks =
      directReportIds.includes(onboarding.employeeId) || isOnboardingAdmin(actor)
        ? onboarding.tasks
        : getVisibleOnboardingTasksForActor(actor, onboarding.employeeId, onboarding.tasks);

    return {
      ...onboarding,
      tasks: visibleTasks,
      summary: summarizeTasks(visibleTasks),
    };
  });
}

export async function getOnboardingDetailForActor(
  actor: AuthorizationActor,
  onboardingId: string
) {
  const onboarding = await prisma.employeeOnboarding.findUnique({
    where: { id: onboardingId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: true,
          title: true,
          managerId: true,
          manager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      },
      template: {
        select: {
          id: true,
          name: true,
        },
      },
      tasks: {
        include: {
          documentRequirements: {
            orderBy: [{ createdAt: "asc" }],
            include: {
              linkedEmployeeDocument: {
                select: {
                  id: true,
                  originalFileName: true,
                  category: true,
                  status: true,
                },
              },
            },
          },
          acknowledgementRequirements: {
            orderBy: [{ createdAt: "asc" }],
            include: {
              assignableDocument: {
                select: {
                  id: true,
                  title: true,
                  category: true,
                },
              },
              assignedDocumentVersion: {
                select: {
                  id: true,
                  versionLabel: true,
                  publishedAt: true,
                },
              },
              employeeDocumentAssignment: {
                select: {
                  id: true,
                  status: true,
                  assignedAt: true,
                  dueDate: true,
                  acknowledgedAt: true,
                },
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  if (!onboarding) {
    return null;
  }

  if (!(await canActorViewOnboarding(actor, onboarding))) {
    throw new AuthorizationError(
      "You do not have permission to view this onboarding record.",
      { status: 403, code: "FORBIDDEN" }
    );
  }

  const visibleTasks = await isManagerOf(actor.id, onboarding.employeeId)
    ? onboarding.tasks
    : getVisibleOnboardingTasksForActor(actor, onboarding.employeeId, onboarding.tasks);

  const activeDocuments = isOnboardingAdmin(actor)
    ? await listEmployeeDocumentsForActor(actor, onboarding.employeeId)
    : [];

  return {
    ...onboarding,
    tasks: visibleTasks,
    summary: summarizeTasks(visibleTasks),
    activeDocuments,
  };
}

export async function createOnboardingFromTemplate(input: {
  employeeId: string;
  templateId: string;
  actorId: string;
}) {
  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: {
      id: true,
      managerId: true,
      firstName: true,
      lastName: true,
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const existingOnboarding = await prisma.employeeOnboarding.findUnique({
    where: { employeeId: employee.id },
    select: { id: true },
  });

  if (existingOnboarding) {
    throw new Error("An onboarding record already exists for this employee.");
  }

  const template = await prisma.onboardingTemplate.findFirst({
    where: {
      id: input.templateId,
      isActive: true,
    },
    include: {
      tasks: {
        include: {
          documentRequirements: {
            orderBy: [{ sortOrder: "asc" }],
          },
          acknowledgementRequirements: {
            orderBy: [{ sortOrder: "asc" }],
            include: {
              assignableDocument: {
                select: {
                  id: true,
                  currentVersionId: true,
                },
              },
            },
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  if (!template) {
    throw new Error("Onboarding template not found.");
  }

  const startDate = new Date();
  const dueDates = template.tasks
    .map((task) => calculateDueDate(startDate, task.dueOffsetDays))
    .filter((value): value is Date => Boolean(value))
    .sort((a, b) => b.getTime() - a.getTime());

  try {
    const result = await prisma.$transaction(async (tx) => {
      const onboarding = await tx.employeeOnboarding.create({
        data: {
          employeeId: employee.id,
          templateId: template.id,
          status: "IN_PROGRESS",
          startDate,
          targetCompletionDate: dueDates[0] ?? null,
          createdByEmployeeId: input.actorId,
        },
      });

      const notificationOutboxIds: string[] = [];

      for (const task of template.tasks) {
        const createdTask = await tx.employeeOnboardingTask.create({
          data: {
            employeeOnboardingId: onboarding.id,
            employeeId: employee.id,
            title: task.title,
            description: task.description,
            assigneeType: task.assigneeType,
            assignedEmployeeId: assignedEmployeeIdForTask({
              assigneeType: task.assigneeType as OnboardingAssigneeType,
              employeeId: employee.id,
              managerId: employee.managerId,
            }),
            dueDate: calculateDueDate(startDate, task.dueOffsetDays),
            status: "PENDING",
            sortOrder: task.sortOrder,
            sourceTemplateTaskId: task.id,
          },
        });

        for (const requirement of task.documentRequirements) {
          await tx.employeeOnboardingTaskDocumentRequirement.create({
            data: {
              employeeOnboardingTaskId: createdTask.id,
              label: requirement.label,
              documentCategory: requirement.documentCategory,
              isRequired: requirement.isRequired,
            },
          });
        }

        for (const requirement of task.acknowledgementRequirements) {
          const assignedDocumentVersionId =
            requirement.assignableDocument.currentVersionId;

          if (!assignedDocumentVersionId) {
            throw new Error(
              `Assignable document "${requirement.label}" does not have a current published version.`
            );
          }

          const createdAcknowledgementRequirement =
            await tx.employeeOnboardingTaskAcknowledgementRequirement.create({
              data: {
                employeeOnboardingTaskId: createdTask.id,
                label: requirement.label,
                assignableDocumentId: requirement.assignableDocumentId,
                assignedDocumentVersionId,
                isRequired: requirement.isRequired,
              },
            });

          const assignment = await createEmployeeDocumentAssignmentRecord(tx, {
            employeeId: employee.id,
            actorId: input.actorId,
            assignableDocumentVersionId: assignedDocumentVersionId,
            assignmentSourceType: "ONBOARDING",
            sourceEmployeeOnboardingTaskRequirementId:
              createdAcknowledgementRequirement.id,
          });

          await tx.employeeOnboardingTaskAcknowledgementRequirement.update({
            where: { id: createdAcknowledgementRequirement.id },
            data: {
              employeeDocumentAssignmentId: assignment.id,
            },
          });

          if (assignment.notificationOutbox?.id) {
            notificationOutboxIds.push(assignment.notificationOutbox.id);
          }
        }
      }

      return {
        onboarding,
        notificationOutboxIds,
      };
    });

    dispatchDocumentAssignmentNotificationOutboxEntries(
      result.notificationOutboxIds
    );

    return result.onboarding;
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("An onboarding record already exists for this employee.");
    }

    throw error;
  }
}

export async function updateOnboardingTaskStatus(input: {
  actor: AuthorizationActor;
  onboardingId: string;
  taskId: string;
  status: OnboardingTaskStatus;
}) {
  const onboarding = await prisma.employeeOnboarding.findUnique({
    where: { id: input.onboardingId },
    include: {
      tasks: true,
    },
  });

  if (!onboarding) {
    throw new Error("Onboarding record not found.");
  }

  const task = onboarding.tasks.find((item) => item.id === input.taskId);

  if (!task) {
    throw new Error("Onboarding task not found.");
  }

  if (!(await canActorUpdateOnboardingTask(input.actor, onboarding.employeeId, task))) {
    throw new AuthorizationError(
      "You do not have permission to update this onboarding task.",
      { status: 403, code: "FORBIDDEN" }
    );
  }

  return prisma.$transaction(async (tx) => {
    const updatedTask = await tx.employeeOnboardingTask.update({
      where: { id: task.id },
      data: {
        status: input.status,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
        completedByEmployeeId:
          input.status === "COMPLETED" ? input.actor.id : null,
      },
    });

    const refreshedTasks = await tx.employeeOnboardingTask.findMany({
      where: { employeeOnboardingId: onboarding.id },
    });

    const nextOnboardingStatus = statusForTasks(refreshedTasks);

    await tx.employeeOnboarding.update({
      where: { id: onboarding.id },
      data: {
        status: nextOnboardingStatus,
        completedAt:
          nextOnboardingStatus === "COMPLETED" ? new Date() : null,
      },
    });

    return updatedTask;
  });
}

export async function getEmployeeOnboardingSummary(employeeId: string) {
  const onboarding = await prisma.employeeOnboarding.findUnique({
    where: { employeeId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
        },
      },
      tasks: {
        orderBy: [{ sortOrder: "asc" }],
      },
    },
  });

  if (!onboarding) {
    return null;
  }

  return {
    ...onboarding,
    summary: summarizeTasks(onboarding.tasks),
  };
}

export async function getActiveOnboardingTemplates() {
  return prisma.onboardingTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
}

export async function getOnboardingTemplateList() {
  return prisma.onboardingTemplate.findMany({
    include: {
      tasks: {
        include: {
          documentRequirements: {
            orderBy: [{ sortOrder: "asc" }],
          },
        },
        orderBy: [{ sortOrder: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export function isTemplateTaskInputValid(task: {
  title: string;
  assigneeType: string;
  sortOrder: number;
  dueOffsetDays: number | null;
}) {
  return (
    task.title.trim().length > 0 &&
    task.sortOrder >= 0 &&
    (task.dueOffsetDays == null || task.dueOffsetDays >= 0)
  );
}

export function isTemplateTaskDocumentRequirementInputValid(requirement: {
  label: string;
  documentCategory: string;
  sortOrder: number;
}) {
  return (
    requirement.label.trim().length > 0 &&
    requirement.documentCategory.trim().length > 0 &&
    requirement.sortOrder >= 0
  );
}

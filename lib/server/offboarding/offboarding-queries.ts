import type { EmployeeOffboardingTask } from "@prisma/client";

import { getDirectReportIds } from "../../auth/access";
import { prisma } from "../../db";
import type { AuthorizationActor } from "../authorization";
import {
  assertCanViewOffboarding,
  assertCanUpdateOffboardingTask,
  isOffboardingAdmin,
  isOffboardingItUser,
} from "./offboarding-access";
import type {
  OffboardingDetail,
  OffboardingProgress,
  OffboardingQueueItem,
} from "./types";

export function calculateOffboardingProgress(
  tasks: Array<Pick<EmployeeOffboardingTask, "status">>
): OffboardingProgress {
  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(
    (task) => task.status === "COMPLETED"
  ).length;
  const completionPercentage =
    totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  return {
    totalTasks,
    completedTasks,
    completionPercentage,
  };
}

function getVisibleOffboardingTasksForActor<T extends { assigneeType: string }>(
  actor: AuthorizationActor,
  isDirectReportManager: boolean,
  tasks: T[]
) {
  if (isOffboardingAdmin(actor) || isDirectReportManager) {
    return tasks;
  }

  if (isOffboardingItUser(actor)) {
    return tasks.filter((task) => task.assigneeType === "IT");
  }

  return [];
}

export async function getOffboardingById(
  actor: AuthorizationActor,
  offboardingId: string
): Promise<OffboardingDetail | null> {
  const offboarding = await prisma.employeeOffboarding.findUnique({
    where: { id: offboardingId },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          department: true,
          managerId: true,
        },
      },
      template: {
        select: {
          id: true,
          name: true,
        },
      },
      tasks: {
        orderBy: [{ sortOrder: "asc" }],
        select: {
          id: true,
          title: true,
          description: true,
          assigneeType: true,
          dueDate: true,
          status: true,
          sortOrder: true,
          assignedEmployeeId: true,
          completedAt: true,
          sourceTemplateTaskId: true,
        },
      },
    },
  });

  if (!offboarding) {
    return null;
  }

  await assertCanViewOffboarding(actor, offboarding);
  const directReportIds =
    !isOffboardingAdmin(actor) && actor.roles.includes("MANAGER")
      ? await getDirectReportIds(actor.id)
      : [];
  const isDirectReportManager = directReportIds.includes(offboarding.employeeId);

  const visibleTasks = getVisibleOffboardingTasksForActor(
    actor,
    isDirectReportManager,
    offboarding.tasks
  );

  return {
    ...offboarding,
    tasks: visibleTasks,
    progress: calculateOffboardingProgress(visibleTasks),
  };
}

export async function getOffboardingQueue(
  actor: AuthorizationActor
): Promise<OffboardingQueueItem[]> {
  let employeeIds: string[] | undefined;
  const isItUser = isOffboardingItUser(actor);
  const directReportIds =
    !isOffboardingAdmin(actor) && actor.roles.includes("MANAGER")
      ? await getDirectReportIds(actor.id)
      : [];

  if (!isOffboardingAdmin(actor) && !isItUser) {
    employeeIds = directReportIds;

    if (employeeIds.length === 0) {
      return [];
    }
  }

  const offboardings = await prisma.employeeOffboarding.findMany({
    where: employeeIds ? { employeeId: { in: employeeIds } } : undefined,
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          department: true,
        },
      },
      tasks: {
        select: {
          assigneeType: true,
          status: true,
        },
      },
    },
    orderBy: [{ terminationDate: "asc" }, { createdAt: "desc" }],
  });

  return offboardings
    .filter((offboarding) => {
      if (isOffboardingAdmin(actor)) {
        return true;
      }

      if (directReportIds.includes(offboarding.employeeId)) {
        return true;
      }

      return (
        isItUser &&
        offboarding.tasks.some((task) => task.assigneeType === "IT")
      );
    })
    .map((offboarding): OffboardingQueueItem => {
      const visibleTasks = getVisibleOffboardingTasksForActor(
        actor,
        directReportIds.includes(offboarding.employeeId),
        offboarding.tasks
      );

      return {
        id: offboarding.id,
        status: offboarding.status,
        separationType: offboarding.separationType,
        terminationDate: offboarding.terminationDate,
        lastWorkingDate: offboarding.lastWorkingDate,
        createdAt: offboarding.createdAt,
        employee: offboarding.employee,
        progress: calculateOffboardingProgress(visibleTasks),
      };
    });
}

export async function getEmployeeOffboardingSummary(employeeId: string) {
  const offboarding = await prisma.employeeOffboarding.findFirst({
    where: { employeeId },
    include: {
      template: {
        select: {
          id: true,
          name: true,
        },
      },
      tasks: {
        select: {
          status: true,
        },
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });

  if (!offboarding) {
    return null;
  }

  return {
    ...offboarding,
    progress: calculateOffboardingProgress(offboarding.tasks),
  };
}

export async function getActiveOffboardingTemplates() {
  return prisma.offboardingTemplate.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });
}

function statusForTasks(
  tasks: Array<Pick<EmployeeOffboardingTask, "status">>
): string {
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

export async function updateOffboardingTaskStatus(input: {
  actor: AuthorizationActor;
  offboardingId: string;
  taskId: string;
  status: string;
}) {
  const offboarding = await prisma.employeeOffboarding.findUnique({
    where: { id: input.offboardingId },
    include: {
      tasks: true,
    },
  });

  if (!offboarding) {
    throw new Error("Offboarding record not found.");
  }

  const task = offboarding.tasks.find((item) => item.id === input.taskId);

  if (!task) {
    throw new Error("Offboarding task not found.");
  }

  await assertCanUpdateOffboardingTask(input.actor, offboarding.employeeId, task);

  return prisma.$transaction(async (tx) => {
    const updatedTask = await tx.employeeOffboardingTask.update({
      where: { id: task.id },
      data: {
        status: input.status,
        completedAt: input.status === "COMPLETED" ? new Date() : null,
        completedByEmployeeId:
          input.status === "COMPLETED" ? input.actor.id : null,
      },
    });

    const refreshedTasks = await tx.employeeOffboardingTask.findMany({
      where: { employeeOffboardingId: offboarding.id },
      select: {
        status: true,
      },
    });

    const nextOffboardingStatus = statusForTasks(refreshedTasks);

    await tx.employeeOffboarding.update({
      where: { id: offboarding.id },
      data: {
        status: nextOffboardingStatus,
        completedAt:
          nextOffboardingStatus === "COMPLETED" ? new Date() : null,
      },
    });

    return updatedTask;
  });
}

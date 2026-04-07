import { Prisma } from "@prisma/client";

import { prisma } from "../../db";
import { AuthorizationError, requireActor } from "../authorization";
import { assertCanCreateOffboarding } from "./offboarding-access";
import { getOffboardingById } from "./offboarding-queries";
import type {
  CreateEmployeeOffboardingInput,
  OffboardingAssigneeType,
  OffboardingDetail,
  OffboardingStatus,
} from "./types";

function addDays(baseDate: Date, days: number) {
  const next = new Date(baseDate);
  next.setDate(next.getDate() + days);
  return next;
}

function calculateTaskDueDate(
  terminationDate: Date,
  dueOffsetDays: number | null
) {
  if (dueOffsetDays == null) {
    return null;
  }

  return addDays(terminationDate, dueOffsetDays);
}

function assignedEmployeeIdForTask(input: {
  assigneeType: OffboardingAssigneeType;
  managerId: string | null;
}) {
  if (input.assigneeType === "MANAGER") {
    return input.managerId;
  }

  return null;
}

export async function createEmployeeOffboarding(
  input: CreateEmployeeOffboardingInput
): Promise<OffboardingDetail> {
  const actor = await requireActor();

  if (actor.id !== input.actorId) {
    throw new AuthorizationError("You do not have permission to create offboarding records.", {
      status: 403,
      code: "FORBIDDEN",
    });
  }

  assertCanCreateOffboarding(actor);

  const employee = await prisma.employee.findUnique({
    where: { id: input.employeeId },
    select: {
      id: true,
      managerId: true,
    },
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  const existingOffboarding = await prisma.employeeOffboarding.findFirst({
    where: {
      employeeId: employee.id,
      status: {
        not: "CANCELLED",
      },
    },
    select: { id: true },
  });

  if (existingOffboarding) {
    throw new Error("An offboarding record already exists for this employee.");
  }

  const template = input.templateId
    ? await prisma.offboardingTemplate.findFirst({
        where: {
          id: input.templateId,
          isActive: true,
        },
        include: {
          tasks: {
            orderBy: [{ sortOrder: "asc" }],
          },
        },
      })
    : null;

  if (input.templateId && !template) {
    throw new Error("Offboarding template not found.");
  }

  const initialStatus: OffboardingStatus =
    template && template.tasks.length > 0 ? "IN_PROGRESS" : "NOT_STARTED";

  const createdOffboarding = await prisma.$transaction(
    async (tx: Prisma.TransactionClient) => {
      const offboarding = await tx.employeeOffboarding.create({
        data: {
        employeeId: employee.id,
        templateId: template?.id ?? null,
        status: initialStatus,
        separationType: input.separationType,
        terminationDate: input.terminationDate,
        lastWorkingDate: input.lastWorkingDate ?? null,
        eligibleForRehire: input.eligibleForRehire ?? null,
        notes: input.notes?.trim() || null,
        createdByEmployeeId: actor.id,
      },
    });

    for (const task of template?.tasks ?? []) {
      await tx.employeeOffboardingTask.create({
        data: {
          employeeOffboardingId: offboarding.id,
          employeeId: employee.id,
          title: task.title,
          description: task.description,
          assigneeType: task.assigneeType,
          assignedEmployeeId: assignedEmployeeIdForTask({
            assigneeType: task.assigneeType as OffboardingAssigneeType,
            managerId: employee.managerId,
          }),
          dueDate: calculateTaskDueDate(
            input.terminationDate,
            task.dueOffsetDays
          ),
          status: "PENDING",
          sortOrder: task.sortOrder,
          sourceTemplateTaskId: task.id,
        },
      });
    }

      return offboarding;
    }
  );

  try {
    const detail = await getOffboardingById(actor, createdOffboarding.id);

    if (!detail) {
      throw new Error("Created offboarding record could not be loaded.");
    }

    return detail;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      throw error;
    }

    throw error;
  }
}

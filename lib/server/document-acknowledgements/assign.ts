import { Prisma } from "@prisma/client";

import { prisma } from "../../db";
import { enqueueDocumentAssignmentHrNotification } from "../hr-notifications/document-acknowledgements";
import {
  assertCanManageDocumentAcknowledgements,
  requireDocumentAcknowledgementActor,
} from "./access";
import type { AssignDocumentInput } from "./types";

function normalizeTargetEmployeeIds(input: {
  employeeId?: string;
  employeeIds?: string[];
}) {
  const unique = new Set<string>();

  if (input.employeeId?.trim()) {
    unique.add(input.employeeId.trim());
  }

  for (const employeeId of input.employeeIds ?? []) {
    const trimmed = employeeId.trim();
    if (trimmed) {
      unique.add(trimmed);
    }
  }

  return Array.from(unique);
}

export async function createEmployeeDocumentAssignmentRecord(
  tx: Prisma.TransactionClient,
  input: {
    employeeId: string;
    actorId: string;
    assignableDocumentVersionId: string;
    dueDate?: Date | null;
    assignmentSourceType?: string;
    sourceEmployeeOnboardingTaskRequirementId?: string | null;
    sendNotification?: boolean;
  }
) {
  const [employee, version] = await Promise.all([
    tx.employee.findUnique({
      where: { id: input.employeeId },
      select: { id: true },
    }),
    tx.assignableDocumentVersion.findUnique({
      where: { id: input.assignableDocumentVersionId },
      select: {
        id: true,
        assignableDocumentId: true,
      },
    }),
  ]);

  if (!employee) {
    throw new Error("Employee not found.");
  }

  if (!version) {
    throw new Error("Assignable document version not found.");
  }

  try {
    return await tx.employeeDocumentAssignment.create({
      data: {
        employeeId: employee.id,
        assignableDocumentId: version.assignableDocumentId,
        assignableDocumentVersionId: version.id,
        assignmentSourceType: input.assignmentSourceType ?? "DIRECT",
        sourceEmployeeOnboardingTaskRequirementId:
          input.sourceEmployeeOnboardingTaskRequirementId ?? null,
        status: "PENDING",
        assignedByEmployeeId: input.actorId,
        dueDate: input.dueDate ?? null,
        ...(input.sendNotification === false
          ? {}
          : {
              notificationOutbox: {
                create: {
                  employeeId: employee.id,
                },
              },
            }),
      },
      select: {
        id: true,
        employeeId: true,
        assignableDocumentId: true,
        assignableDocumentVersionId: true,
        assignmentSourceType: true,
        sourceEmployeeOnboardingTaskRequirementId: true,
        status: true,
        assignedAt: true,
        dueDate: true,
        notificationOutbox: {
          select: {
            id: true,
            status: true,
          },
        },
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error(
        "An active assignment already exists for this employee and document version."
      );
    }

    throw error;
  }
}

export async function assignDocumentVersionToEmployee(
  input: AssignDocumentInput
) {
  const result = await assignDocumentVersionToEmployees(input);

  if (result.assignments.length === 0) {
    throw new Error("Employee not found.");
  }

  return result.assignments[0];
}

export async function assignDocumentVersionToEmployees(
  input: AssignDocumentInput
) {
  const actor = await requireDocumentAcknowledgementActor();

  if (actor.id !== input.actorId) {
    throw new Error("Assignment actor is invalid.");
  }

  assertCanManageDocumentAcknowledgements(actor);

  const employeeIds = normalizeTargetEmployeeIds({
    employeeId: input.employeeId,
    employeeIds: input.employeeIds,
  });

  if (employeeIds.length === 0) {
    throw new Error("At least one employee is required.");
  }

  const assignments = await prisma.$transaction(async (tx) => {
    const createdAssignments = [];

    for (const employeeId of employeeIds) {
      const assignment = await createEmployeeDocumentAssignmentRecord(tx, {
        employeeId,
        actorId: actor.id,
        assignableDocumentVersionId: input.assignableDocumentVersionId,
        dueDate: input.dueDate ?? null,
        assignmentSourceType: "DIRECT",
        sendNotification: input.sendNotification,
      });

      createdAssignments.push(assignment);
    }

    return createdAssignments;
  });

  const notificationOutboxIds = assignments
    .map((assignment) => assignment.notificationOutbox?.id ?? null)
    .filter((value): value is string => Boolean(value));

  for (const outboxId of notificationOutboxIds) {
    await enqueueDocumentAssignmentHrNotification({
      documentAssignmentOutboxId: outboxId,
      actorId: actor.id,
    });
  }

  return {
    targetEmployeeIds: employeeIds,
    assignments,
  };
}

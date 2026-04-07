import { prisma } from "../db";
import { createEmployeeDocument } from "./documents/create-document";
import type { AuthorizationActor } from "./authorization";
import { AuthorizationError } from "./authorization";
import { isOnboardingAdmin } from "./onboarding";

async function getOnboardingRequirementContext(input: {
  onboardingId: string;
  taskId: string;
  requirementId: string;
}) {
  const onboarding = await prisma.employeeOnboarding.findUnique({
    where: { id: input.onboardingId },
    select: {
      id: true,
      employeeId: true,
    },
  });

  if (!onboarding) {
    throw new Error("Onboarding record not found.");
  }

  const task = await prisma.employeeOnboardingTask.findUnique({
    where: { id: input.taskId },
    select: {
      id: true,
      employeeOnboardingId: true,
    },
  });

  if (!task || task.employeeOnboardingId !== onboarding.id) {
    throw new Error("Onboarding task not found.");
  }

  const requirement = await prisma.employeeOnboardingTaskDocumentRequirement.findUnique({
    where: { id: input.requirementId },
    select: {
      id: true,
      employeeOnboardingTaskId: true,
      documentCategory: true,
    },
  });

  if (!requirement || requirement.employeeOnboardingTaskId !== task.id) {
    throw new Error("Onboarding document requirement not found.");
  }

  return {
    onboarding,
    task,
    requirement,
  };
}

export async function linkEmployeeDocumentToOnboardingRequirement(input: {
  actor: AuthorizationActor;
  onboardingId: string;
  taskId: string;
  requirementId: string;
  employeeDocumentId: string;
}) {
  if (!isOnboardingAdmin(input.actor)) {
    throw new AuthorizationError(
      "You do not have permission to link onboarding documents.",
      { status: 403, code: "FORBIDDEN" }
    );
  }

  const { onboarding, requirement } = await getOnboardingRequirementContext({
    onboardingId: input.onboardingId,
    taskId: input.taskId,
    requirementId: input.requirementId,
  });

  const document = await prisma.employeeDocument.findUnique({
    where: { id: input.employeeDocumentId },
    select: {
      id: true,
      employeeId: true,
      category: true,
      status: true,
    },
  });

  if (!document || document.status !== "ACTIVE") {
    throw new Error("Employee document not found.");
  }

  if (document.employeeId !== onboarding.employeeId) {
    throw new Error("Employee document does not belong to this onboarding employee.");
  }

  if (document.category !== requirement.documentCategory) {
    throw new Error("Employee document category does not match requirement.");
  }

  return prisma.employeeOnboardingTaskDocumentRequirement.update({
    where: { id: requirement.id },
    data: {
      linkedEmployeeDocumentId: document.id,
      linkedAt: new Date(),
      linkedByEmployeeId: input.actor.id,
    },
    select: {
      id: true,
      label: true,
      documentCategory: true,
      isRequired: true,
      linkedAt: true,
      linkedByEmployeeId: true,
      linkedEmployeeDocument: {
        select: {
          id: true,
          originalFileName: true,
          category: true,
        },
      },
    },
  });
}

export async function uploadEmployeeDocumentForOnboardingRequirement(input: {
  actor: AuthorizationActor;
  onboardingId: string;
  taskId: string;
  requirementId: string;
  file: File;
}) {
  const { onboarding, requirement } = await getOnboardingRequirementContext({
    onboardingId: input.onboardingId,
    taskId: input.taskId,
    requirementId: input.requirementId,
  });

  const canUpload =
    isOnboardingAdmin(input.actor) || input.actor.id === onboarding.employeeId;

  if (!canUpload) {
    throw new AuthorizationError(
      "You do not have permission to upload required onboarding documents.",
      { status: 403, code: "FORBIDDEN" }
    );
  }

  const document = await createEmployeeDocument({
    actor: input.actor,
    employeeId: onboarding.employeeId,
    category: requirement.documentCategory,
    description: null,
    file: input.file,
    skipUploadAuthorization: true,
  });

  const linkedRequirement = await prisma.employeeOnboardingTaskDocumentRequirement.update({
    where: { id: requirement.id },
    data: {
      linkedEmployeeDocumentId: document.id,
      linkedAt: new Date(),
      linkedByEmployeeId: input.actor.id,
    },
    select: {
      id: true,
      label: true,
      documentCategory: true,
      isRequired: true,
      linkedAt: true,
      linkedByEmployeeId: true,
      linkedEmployeeDocument: {
        select: {
          id: true,
          originalFileName: true,
          category: true,
        },
      },
    },
  });

  return {
    document,
    requirement: linkedRequirement,
  };
}

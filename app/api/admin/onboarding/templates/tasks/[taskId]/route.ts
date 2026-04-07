import { NextResponse } from "next/server";

import { prisma } from "../../../../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../../../lib/server/authorization";
import {
  isOnboardingAssigneeType,
} from "../../../../../../../lib/onboarding/constants";
import { isEmployeeDocumentCategory } from "../../../../../../../lib/documents/constants";
import {
  isTemplateTaskDocumentRequirementInputValid,
  isTemplateTaskInputValid,
} from "../../../../../../../lib/server/onboarding";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    await requireAdmin({
      attemptedAction: "ONBOARDING_TEMPLATE_TASK_UPDATE",
      entityType: "OnboardingTemplateTask",
      entityId: taskId,
    });

    const existing = await prisma.onboardingTemplateTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Onboarding template task not found." },
        { status: 404 }
      );
    }

    const body = await request.json();
    const title = String(body.title || "").trim();
    const description =
      body.description == null || String(body.description).trim() === ""
        ? null
        : String(body.description).trim();
    const assigneeType = String(body.assigneeType || "").trim();
    const dueOffsetDays =
      body.dueOffsetDays == null || body.dueOffsetDays === ""
        ? null
        : Number(body.dueOffsetDays);
    const sortOrder = Number(body.sortOrder);
    const isRequired =
      typeof body.isRequired === "boolean" ? body.isRequired : true;
    const documentRequirements = Array.isArray(body.documentRequirements)
      ? body.documentRequirements
      : [];

    if (!isOnboardingAssigneeType(assigneeType)) {
      return NextResponse.json(
        { error: "Assignee type is invalid." },
        { status: 400 }
      );
    }

    if (
      !isTemplateTaskInputValid({
        title,
        assigneeType,
        sortOrder,
        dueOffsetDays,
      })
    ) {
      return NextResponse.json(
        { error: "Task title, due offset, or sort order is invalid." },
        { status: 400 }
      );
    }

    const normalizedRequirements: Array<{
      label: string;
      documentCategory: string;
      isRequired: boolean;
      sortOrder: number;
    }> = [];

    for (const item of documentRequirements) {
      const requirement = item as Record<string, unknown>;
      const label = String(requirement.label || "").trim();
      const documentCategory = String(requirement.documentCategory || "").trim();
      const requirementIsRequired =
        typeof requirement.isRequired === "boolean"
          ? requirement.isRequired
          : true;
      const requirementSortOrder = Number(requirement.sortOrder);

      if (
        !isEmployeeDocumentCategory(documentCategory) ||
        !isTemplateTaskDocumentRequirementInputValid({
          label,
          documentCategory,
          sortOrder: requirementSortOrder,
        })
      ) {
        return NextResponse.json(
          { error: "Document requirement label, category, or sort order is invalid." },
          { status: 400 }
        );
      }

      normalizedRequirements.push({
        label,
        documentCategory,
        isRequired: requirementIsRequired,
        sortOrder: requirementSortOrder,
      });
    }

    const task = await prisma.$transaction(async (tx) => {
      await tx.onboardingTemplateTaskDocumentRequirement.deleteMany({
        where: { templateTaskId: taskId },
      });

      return tx.onboardingTemplateTask.update({
        where: { id: taskId },
        data: {
          title,
          description,
          assigneeType,
          dueOffsetDays,
          sortOrder,
          isRequired,
          documentRequirements: normalizedRequirements.length
            ? {
                create: normalizedRequirements,
              }
            : undefined,
        },
        include: {
          documentRequirements: {
            orderBy: [{ sortOrder: "asc" }],
          },
        },
      });
    });

    return NextResponse.json({ task });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to update onboarding template task." },
      { status: 500 }
    );
  }
}

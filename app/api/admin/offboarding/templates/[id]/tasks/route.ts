import { NextResponse } from "next/server";

import { prisma } from "../../../../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../../../lib/server/authorization";
import {
  isOffboardingAssigneeType,
  isOffboardingTemplateTaskInputValid,
} from "../../../../../../../lib/server/offboarding/types";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin({
      attemptedAction: "OFFBOARDING_TEMPLATE_TASK_CREATE",
      entityType: "OffboardingTemplate",
      entityId: id,
    });

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

    if (!isOffboardingAssigneeType(assigneeType)) {
      return NextResponse.json(
        { error: "Assignee type is invalid." },
        { status: 400 }
      );
    }

    if (
      !isOffboardingTemplateTaskInputValid({
        title,
        sortOrder,
        dueOffsetDays,
      })
    ) {
      return NextResponse.json(
        { error: "Task title, due offset, or sort order is invalid." },
        { status: 400 }
      );
    }

    const template = await prisma.offboardingTemplate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!template) {
      return NextResponse.json(
        { error: "Offboarding template not found." },
        { status: 404 }
      );
    }

    const task = await prisma.offboardingTemplateTask.create({
      data: {
        templateId: template.id,
        title,
        description,
        assigneeType,
        dueOffsetDays,
        sortOrder,
        isRequired,
      },
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
      { error: "Failed to create offboarding template task." },
      { status: 500 }
    );
  }
}

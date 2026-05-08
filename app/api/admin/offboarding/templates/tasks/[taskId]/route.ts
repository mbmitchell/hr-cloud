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

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    await requireAdmin({
      attemptedAction: "OFFBOARDING_TEMPLATE_TASK_UPDATE",
      entityType: "OffboardingTemplateTask",
      entityId: taskId,
    });

    const existing = await prisma.offboardingTemplateTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Offboarding template task not found." },
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

    const task = await prisma.offboardingTemplateTask.update({
      where: { id: taskId },
      data: {
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
      { error: "Failed to update offboarding template task." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ taskId: string }> }
) {
  try {
    const { taskId } = await params;
    await requireAdmin({
      attemptedAction: "OFFBOARDING_TEMPLATE_TASK_DELETE",
      entityType: "OffboardingTemplateTask",
      entityId: taskId,
    });

    const existing = await prisma.offboardingTemplateTask.findUnique({
      where: { id: taskId },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Offboarding template task not found." },
        { status: 404 }
      );
    }

    await prisma.offboardingTemplateTask.delete({
      where: { id: taskId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to remove offboarding template task." },
      { status: 500 }
    );
  }
}

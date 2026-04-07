import { NextResponse } from "next/server";

import { prisma } from "../../../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../../lib/server/authorization";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    await requireAdmin({
      attemptedAction: "ONBOARDING_TEMPLATE_UPDATE",
      entityType: "OnboardingTemplate",
      entityId: id,
    });

    const body = await request.json();
    const name = String(body.name || "").trim();
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : undefined;

    const existing = await prisma.onboardingTemplate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Onboarding template not found." },
        { status: 404 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required." },
        { status: 400 }
      );
    }

    const template = await prisma.onboardingTemplate.update({
      where: { id },
      data: {
        name,
        ...(isActive === undefined ? {} : { isActive }),
      },
    });

    return NextResponse.json({ template });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to update onboarding template." },
      { status: 500 }
    );
  }
}

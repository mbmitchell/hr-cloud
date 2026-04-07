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
      attemptedAction: "OFFBOARDING_TEMPLATE_UPDATE",
      entityType: "OffboardingTemplate",
      entityId: id,
    });

    const body = await request.json();
    const name = String(body.name || "").trim();
    const isActive =
      typeof body.isActive === "boolean" ? body.isActive : undefined;

    const existing = await prisma.offboardingTemplate.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Offboarding template not found." },
        { status: 404 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required." },
        { status: 400 }
      );
    }

    const template = await prisma.offboardingTemplate.update({
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
      { error: "Failed to update offboarding template." },
      { status: 500 }
    );
  }
}

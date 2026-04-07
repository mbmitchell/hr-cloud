import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../lib/server/authorization";

async function getOffboardingTemplateList() {
  return prisma.offboardingTemplate.findMany({
    include: {
      tasks: {
        orderBy: [{ sortOrder: "asc" }],
      },
    },
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function GET() {
  try {
    await requireAdmin({
      attemptedAction: "OFFBOARDING_TEMPLATE_VIEW",
      entityType: "OffboardingTemplate",
      entityId: "all",
    });

    const templates = await getOffboardingTemplateList();
    return NextResponse.json({ templates });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load offboarding templates." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin({
      attemptedAction: "OFFBOARDING_TEMPLATE_CREATE",
      entityType: "OffboardingTemplate",
      entityId: "new",
    });

    const body = await request.json();
    const name = String(body.name || "").trim();

    if (!name) {
      return NextResponse.json(
        { error: "Template name is required." },
        { status: 400 }
      );
    }

    const template = await prisma.offboardingTemplate.create({
      data: {
        name,
        isActive: true,
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
      { error: "Failed to create offboarding template." },
      { status: 500 }
    );
  }
}

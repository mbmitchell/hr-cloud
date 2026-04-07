import { NextResponse } from "next/server";

import { prisma } from "../../../../../lib/db";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../../lib/server/authorization";
import { getOnboardingTemplateList } from "../../../../../lib/server/onboarding";

export async function GET() {
  try {
    await requireAdmin({
      attemptedAction: "ONBOARDING_TEMPLATE_VIEW",
      entityType: "OnboardingTemplate",
      entityId: "all",
    });

    const templates = await getOnboardingTemplateList();
    return NextResponse.json({ templates });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load onboarding templates." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    await requireAdmin({
      attemptedAction: "ONBOARDING_TEMPLATE_CREATE",
      entityType: "OnboardingTemplate",
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

    const template = await prisma.onboardingTemplate.create({
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
      { error: "Failed to create onboarding template." },
      { status: 500 }
    );
  }
}

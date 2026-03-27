import { prisma } from "../../../../lib/db";
import { NextResponse } from "next/server";
import { requireCurrentUser, currentUserHasAnyRole } from "../../../../lib/auth/access";
import { getPolicySettings } from "../../../../lib/policy/settings";

export async function GET() {
  try {
    const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to view policy settings." },
        { status: 403 }
      );
    }

    const settings = await getPolicySettings();
    return NextResponse.json(settings);
  } catch {
    return NextResponse.json(
      { error: "Failed to load policy settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to update policy settings." },
        { status: 403 }
      );
    }

    const currentUser = await requireCurrentUser();
    const body = await request.json();

    const accrualRate0To5 = Number(body.accrualRate0To5);
    const accrualRate6To10 = Number(body.accrualRate6To10);
    const accrualRateOver10 = Number(body.accrualRateOver10);
    const rolloverCapHours = Number(body.rolloverCapHours);

    if (
      [accrualRate0To5, accrualRate6To10, accrualRateOver10, rolloverCapHours].some(
        (value) => Number.isNaN(value) || value < 0
      )
    ) {
      return NextResponse.json(
        { error: "All policy values must be zero or greater." },
        { status: 400 }
      );
    }

    const existing = await getPolicySettings();

    const updated = await prisma.policySettings.update({
      where: { id: existing.id },
      data: {
        accrualRate0To5,
        accrualRate6To10,
        accrualRateOver10,
        rolloverCapHours,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "POLICY_UPDATE",
        entityType: "PolicySettings",
        entityId: updated.id,
        oldValue: JSON.stringify(existing),
        newValue: JSON.stringify(updated),
      },
    });

    return NextResponse.json(updated);
  } catch {
    return NextResponse.json(
      { error: "Failed to update policy settings." },
      { status: 500 }
    );
  }
}
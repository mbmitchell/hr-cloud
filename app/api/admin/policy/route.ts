import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db";
import { getPolicySettings } from "../../../../lib/policy/settings";
import {
  isAuthorizationError,
  requireAdmin,
} from "../../../../lib/server/authorization";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";

export async function GET() {
  try {
    await requireAdmin({
      attemptedAction: "POLICY_VIEW",
      entityType: "PolicySettings",
      entityId: "singleton",
    });

    const settings = await getPolicySettings();
    return NextResponse.json(settings);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load policy settings." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const currentUser = await requireAdmin({
      attemptedAction: "POLICY_UPDATE",
      entityType: "PolicySettings",
      entityId: "singleton",
    });
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

    const updated = await prisma.$transaction(async (tx) => {
      const saved = await tx.policySettings.update({
        where: { id: existing.id },
        data: {
          accrualRate0To5,
          accrualRate6To10,
          accrualRateOver10,
          rolloverCapHours,
        },
      });

      await writeAuditLog(tx, {
        userId: currentUser.id,
        action: "POLICY_UPDATE",
        entityType: "PolicySettings",
        entityId: saved.id,
        oldValue: existing,
        newValue: saved,
      });

      return saved;
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to update policy settings." },
      { status: 500 }
    );
  }
}

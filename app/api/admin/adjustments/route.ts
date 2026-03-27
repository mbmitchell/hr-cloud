import { prisma } from "../../../../lib/db";
import { NextResponse } from "next/server";
import { canCurrentUserManageAdjustments, requireCurrentUser } from "../../../../lib/auth/access";

export async function POST(request: Request) {
  try {
    const allowed = await canCurrentUserManageAdjustments();

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to post adjustments." },
        { status: 403 }
      );
    }

    const currentUser = await requireCurrentUser();
    const body = await request.json();

    const employeeId = String(body.employeeId || "").trim();
    const bucket = String(body.bucket || "").trim();
    const adjustmentType = String(body.adjustmentType || "").trim();
    const hours = Number(body.hours);
    const effectiveDate = String(body.effectiveDate || "").trim();
    const reason = String(body.reason || "").trim();

    if (!employeeId || !bucket || !adjustmentType || !hours || !effectiveDate || !reason) {
      return NextResponse.json(
        { error: "Missing required fields." },
        { status: 400 }
      );
    }

    if (!["PTO", "COMP"].includes(bucket)) {
      return NextResponse.json(
        { error: "Invalid bucket." },
        { status: 400 }
      );
    }

    if (!["MANUAL_ADD", "MANUAL_SUBTRACT"].includes(adjustmentType)) {
      return NextResponse.json(
        { error: "Invalid adjustment type." },
        { status: 400 }
      );
    }

    if (hours <= 0) {
      return NextResponse.json(
        { error: "Hours must be greater than zero." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    const latestLedger = await prisma.pTOLedger.findFirst({
      where: {
        employeeId,
        bucket,
      },
      orderBy: [
        { effectiveDate: "desc" },
        { createdAt: "desc" },
      ],
    });

    const currentBalance = latestLedger?.balance ?? 0;
    const signedHours = adjustmentType === "MANUAL_SUBTRACT" ? -hours : hours;
    const newBalance = currentBalance + signedHours;

    const ledgerEntry = await prisma.pTOLedger.create({
      data: {
        employeeId,
        bucket,
        type: adjustmentType,
        hours: signedHours,
        balance: newBalance,
        effectiveDate: new Date(effectiveDate),
        notes: reason,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: currentUser.id,
        action: "ADJUSTMENT_CREATE",
        entityType: "PTOLedger",
        entityId: ledgerEntry.id,
        oldValue: JSON.stringify({
          bucket,
          priorBalance: currentBalance,
        }),
        newValue: JSON.stringify({
          bucket,
          adjustmentType,
          hours: signedHours,
          newBalance,
          reason,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      ledgerEntry,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to post adjustment." },
      { status: 500 }
    );
  }
}
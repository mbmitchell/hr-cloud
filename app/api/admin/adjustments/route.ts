import { Prisma } from "@prisma/client";

import { prisma } from "../../../../lib/db";
import { NextResponse } from "next/server";
import {
  canCurrentUserAddCompTimeFor,
  canCurrentUserManageAdjustments,
  requireCurrentUser,
} from "../../../../lib/auth/access";
import { writeAuditLog } from "../../../../lib/server/audit/write-audit-log";

export async function POST(request: Request) {
  try {
    const currentUser = await requireCurrentUser();
    const body = await request.json();

    const employeeId = String(body.employeeId || "").trim();
    const bucket = String(body.bucket || "").trim();
    const adjustmentType = String(body.adjustmentType || "").trim();
    const hours = Number(body.hours);
    const effectiveDate = String(body.effectiveDate || "").trim();
    const reason = String(body.reason || "").trim();

    const canManageAllAdjustments = await canCurrentUserManageAdjustments();
    const canAddCompTimeForEmployee = employeeId
      ? await canCurrentUserAddCompTimeFor(employeeId)
      : false;

    const isManagerScopedCompAdd =
      bucket === "COMP" &&
      adjustmentType === "MANUAL_ADD" &&
      canAddCompTimeForEmployee;

    if (!canManageAllAdjustments && !isManagerScopedCompAdd) {
      return NextResponse.json(
        { error: "You do not have permission to post this adjustment." },
        { status: 403 }
      );
    }

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

    const parsedEffectiveDate = new Date(effectiveDate);

    if (Number.isNaN(parsedEffectiveDate.getTime())) {
      return NextResponse.json(
        { error: "Effective date is invalid." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { id: true },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    const signedHours = adjustmentType === "MANUAL_SUBTRACT" ? -hours : hours;
    const duplicateThreshold = new Date(Date.now() - 2 * 60 * 1000);

    const result = await prisma.$transaction(async (tx) => {
      const duplicateEntry = await tx.pTOLedger.findFirst({
        where: {
          employeeId,
          bucket,
          type: adjustmentType,
          hours: signedHours,
          effectiveDate: parsedEffectiveDate,
          notes: reason,
          createdAt: {
            gte: duplicateThreshold,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (duplicateEntry) {
        return {
          ledgerEntry: duplicateEntry,
          duplicate: true,
        };
      }

      const latestLedger = await tx.pTOLedger.findFirst({
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
      const newBalance = Number((currentBalance + signedHours).toFixed(2));

      const ledgerEntry = await tx.pTOLedger.create({
        data: {
          employeeId,
          bucket,
          type: adjustmentType,
          hours: signedHours,
          balance: newBalance,
          effectiveDate: parsedEffectiveDate,
          notes: reason,
        },
      });

      await writeAuditLog(tx, {
        userId: currentUser.id,
        action: "ADJUSTMENT_CREATE",
        entityType: "PTOLedger",
        entityId: ledgerEntry.id,
        oldValue: {
          bucket,
          priorBalance: currentBalance,
        },
        newValue: {
          bucket,
          adjustmentType,
          hours: signedHours,
          newBalance,
          reason,
        },
      });

      return {
        ledgerEntry,
        duplicate: false,
      };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    return NextResponse.json({
      success: true,
      ledgerEntry: result.ledgerEntry,
      duplicate: result.duplicate,
    });
  } catch (error) {
    console.error("Failed to post adjustment:", error);
    return NextResponse.json(
      { error: "Failed to post adjustment." },
      { status: 500 }
    );
  }
}

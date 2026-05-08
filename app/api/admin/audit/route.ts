import { NextResponse } from "next/server";

import { prisma } from "../../../../lib/db";
import {
  isAuthorizationError,
  requireRole,
} from "../../../../lib/server/authorization";

export async function GET(request: Request) {
  try {
    await requireRole(["SITE_ADMIN", "HR_ADMIN", "AUDITOR"], {
      attemptedAction: "AUDIT_LOG_VIEW",
      entityType: "AuditLog",
      entityId: "list",
    });

    const { searchParams } = new URL(request.url);
    const action = searchParams.get("action");
    const entityType = searchParams.get("entityType");

    const where: {
      action?: string;
      entityType?: string;
    } = {};

    if (action && action !== "ALL") {
      where.action = action;
    }

    if (entityType && entityType !== "ALL") {
      where.entityType = entityType;
    }

    const logs = await prisma.auditLog.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: 250,
    });

    const actions = Array.from(new Set(logs.map((log) => log.action))).sort();
    const entityTypes = Array.from(new Set(logs.map((log) => log.entityType))).sort();

    return NextResponse.json({
      logs,
      filters: {
        actions,
        entityTypes,
      },
    });
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load audit logs." },
      { status: 500 }
    );
  }
}

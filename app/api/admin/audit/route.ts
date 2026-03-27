import { prisma } from "../../../../lib/db";
import { NextResponse } from "next/server";
import { canCurrentUserViewAudit } from "../../../../lib/auth/access";

export async function GET(request: Request) {
  try {
    const allowed = await canCurrentUserViewAudit();

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to view audit logs." },
        { status: 403 }
      );
    }

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
  } catch {
    return NextResponse.json(
      { error: "Failed to load audit logs." },
      { status: 500 }
    );
  }
}
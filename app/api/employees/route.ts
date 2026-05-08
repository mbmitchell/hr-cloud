import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";
import {
  isAuthorizationError,
  requireActor,
} from "../../../lib/server/authorization";
import { getVisibleEmployeeIds } from "../../../lib/server/employee-visibility";

export async function GET() {
  try {
    const actor = await requireActor();
    const visibleEmployeeIds = await getVisibleEmployeeIds(actor.id);

    const employees = await prisma.employee.findMany({
      where: {
        id: {
          in: visibleEmployeeIds,
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        department: true,
      },
      orderBy: [
        { lastName: "asc" },
        { firstName: "asc" },
      ],
    });

    return NextResponse.json(employees);
  } catch (error) {
    if (isAuthorizationError(error)) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }

    return NextResponse.json(
      { error: "Failed to load employees." },
      { status: 500 }
    );
  }
}

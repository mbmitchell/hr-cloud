import { prisma } from "../../../../../lib/db";
import { NextResponse } from "next/server";
import { canCurrentUserManageCompensation } from "../../../../../lib/auth/access";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const allowed = await canCurrentUserManageCompensation();

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to view compensation." },
        { status: 403 }
      );
    }

    const { id } = await params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        payType: true,
        hourlyRate: true,
        annualSalary: true,
        fte: true,
      },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(employee);
  } catch {
    return NextResponse.json(
      { error: "Failed to load compensation." },
      { status: 500 }
    );
  }
}
import { prisma } from "../../../lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const employees = await prisma.employee.findMany({
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
  } catch {
    return NextResponse.json(
      { error: "Failed to load employees." },
      { status: 500 }
    );
  }
}
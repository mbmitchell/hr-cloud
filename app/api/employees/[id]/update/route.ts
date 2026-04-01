import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/db";
import {
  currentUserHasAnyRole,
  requireCurrentUser,
} from "../../../../../lib/auth/access";
import { applyEmployeeUpdate } from "../../../../../lib/server/employees/apply-employee-update";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

    if (!allowed) {
      return NextResponse.json(
        { error: "You do not have permission to update employee information." },
        { status: 403 }
      );
    }

    const currentUser = await requireCurrentUser();
    const { id } = await params;
    const body = await request.json();

    const firstName = String(body.firstName || "").trim();
    const lastName = String(body.lastName || "").trim();
    const email = String(body.email || "").trim();
    const department =
      body.department == null || String(body.department).trim() === ""
        ? null
        : String(body.department).trim();
    const title =
      body.title == null || String(body.title).trim() === ""
        ? null
        : String(body.title).trim();
    const status = String(body.status || "").trim();
    const hireDate = String(body.hireDate || "").trim();
    const managerId =
      body.managerId == null || String(body.managerId).trim() === ""
        ? null
        : String(body.managerId).trim();

    if (!firstName || !lastName || !email || !status || !hireDate) {
      return NextResponse.json(
        {
          error:
            "First name, last name, email, status, and hire date are required.",
        },
        { status: 400 }
      );
    }

    const parsedHireDate = new Date(hireDate);
    if (Number.isNaN(parsedHireDate.getTime())) {
      return NextResponse.json(
        { error: "Hire date is invalid." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.findUnique({
      where: { id },
    });

    if (!employee) {
      return NextResponse.json(
        { error: "Employee not found." },
        { status: 404 }
      );
    }

    if (managerId === id) {
      return NextResponse.json(
        { error: "An employee cannot be their own manager." },
        { status: 400 }
      );
    }

    if (managerId) {
      const manager = await prisma.employee.findUnique({
        where: { id: managerId },
        select: { id: true },
      });

      if (!manager) {
        return NextResponse.json(
          { error: "Selected manager was not found." },
          { status: 400 }
        );
      }
    }

    const emailOwner = await prisma.employee.findUnique({
      where: { email },
      select: { id: true },
    });

    if (emailOwner && emailOwner.id !== id) {
      return NextResponse.json(
        { error: "Email address is already in use by another employee." },
        { status: 400 }
      );
    }

    const updatedEmployee = await prisma.$transaction(async (tx) => {
      return applyEmployeeUpdate(tx, {
        actorId: currentUser.id,
        employeeId: id,
        existingEmployee: employee,
        update: {
          firstName,
          lastName,
          email,
          department,
          title,
          status,
          hireDate: parsedHireDate,
          managerId,
        },
      });
    });

    return NextResponse.json({
      success: true,
      employee: updatedEmployee,
    });
  } catch (error) {
    console.error("Employee update failed:", error);

    return NextResponse.json(
      { error: "Failed to update employee information." },
      { status: 500 }
    );
  }
}

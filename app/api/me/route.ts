import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth/current-user";
import { getEmployeeRoles } from "../../../lib/auth/permissions";

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "No current user found." },
        { status: 401 }
      );
    }

    const roles = await getEmployeeRoles(user.id);

    return NextResponse.json({
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      roles,
      canRequestForOthers:
        roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN"),
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to load current user." },
      { status: 500 }
    );
  }
}
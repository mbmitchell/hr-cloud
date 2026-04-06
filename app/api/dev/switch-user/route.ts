import { NextResponse } from "next/server";

function isDevAuthEnabled() {
  return process.env.AUTH_ENABLE_DEV_AUTH === "true";
}

function isDevUserSwitcherEnabled() {
  return (
    process.env.AUTH_ENABLE_DEV_AUTH === "true" &&
    process.env.AUTH_ENABLE_DEV_USER_SWITCHER === "true"
  );
}

export async function POST(request: Request) {
  if (!isDevAuthEnabled() || !isDevUserSwitcherEnabled()) {
    return NextResponse.json(
      { error: "Dev switcher is disabled." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const employeeId = String(body.employeeId || "").trim();

    const response = NextResponse.json({ success: true });

    response.cookies.set("dev_employee_id", employeeId, {
      // The server reads this cookie; clients do not need script access.
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      secure: process.env.NODE_ENV === "production",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Failed to switch user." },
      { status: 500 }
    );
  }
}

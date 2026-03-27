import { NextResponse } from "next/server";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Dev switcher is disabled in production." },
      { status: 403 }
    );
  }

  try {
    const body = await request.json();
    const employeeId = String(body.employeeId || "").trim();

    const response = NextResponse.json({ success: true });

    response.cookies.set("dev_employee_id", employeeId, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Failed to switch user." },
      { status: 500 }
    );
  }
}
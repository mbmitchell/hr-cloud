import { NextResponse } from "next/server";
import { logSecurityEvent } from "../../../../lib/server/audit/security-events";
import {
  isDevelopmentEnvironment,
  isDevAuthEnabled,
  isDevUserSwitcherEnabled,
} from "../../../../lib/auth/dev-auth-flags";

export async function POST(request: Request) {
  if (!isDevelopmentEnvironment()) {
    await logSecurityEvent({
      eventType: "AUTH_DEV_USER_SWITCH_DENIED",
      provider: "internal",
      outcome: "denied",
      reasonCode: "dev_route_blocked_outside_local_development",
      entityType: "AuthSession",
      entityId: "dev-user-switcher",
    });

    return NextResponse.json(
      {
        error:
          "Dev user switching is only available when local development auth is enabled.",
      },
      { status: 403 }
    );
  }

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
      secure: false,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Failed to switch user." },
      { status: 500 }
    );
  }
}

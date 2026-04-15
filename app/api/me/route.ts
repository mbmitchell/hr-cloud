import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/auth/current-user";
import { getEmployeeRoles } from "../../../lib/auth/permissions";
import { withPrivateNoStoreHeaders } from "../../../lib/server/http/headers";

const allowDevAuth = process.env.AUTH_ENABLE_DEV_AUTH === "true";
const allowDevUserSwitcher =
  process.env.NODE_ENV === "development" &&
  process.env.AUTH_ENABLE_DEV_AUTH === "true" &&
  process.env.AUTH_ENABLE_DEV_USER_SWITCHER === "true";
const allowMicrosoft365Auth = Boolean(
  process.env.AUTH_MICROSOFT_ENTRA_ID_ID &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET &&
    process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER
);

export async function GET() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json(
        { error: "No current user found." },
        withPrivateNoStoreHeaders({ status: 401 })
      );
    }

    const roles = await getEmployeeRoles(user.id);

    return NextResponse.json(
      {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        roles,
        canRequestForOthers:
          roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN"),
        enabledAuthProviders: {
          microsoft365: allowMicrosoft365Auth,
          devCredentials: allowDevAuth,
          devUserSwitcher: allowDevUserSwitcher,
        },
      },
      withPrivateNoStoreHeaders()
    );
  } catch {
    return NextResponse.json(
      { error: "Failed to load current user." },
      withPrivateNoStoreHeaders({ status: 500 })
    );
  }
}

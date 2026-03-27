import { currentUserHasAnyRole } from "../../../lib/auth/access";
import PolicyAdminClient from "./PolicyAdminClient";

export default async function PolicyAdminPage() {
  const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to policy settings.
      </div>
    );
  }

  return <PolicyAdminClient />;
}
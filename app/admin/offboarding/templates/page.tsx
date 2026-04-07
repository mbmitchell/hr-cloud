import { currentUserHasAnyRole } from "../../../../lib/auth/access";
import OffboardingTemplatesAdminClient from "./OffboardingTemplatesAdminClient";

export default async function OffboardingTemplatesPage() {
  const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to offboarding templates.
      </div>
    );
  }

  return <OffboardingTemplatesAdminClient />;
}

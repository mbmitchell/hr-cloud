import { currentUserHasAnyRole } from "../../../../lib/auth/access";
import OnboardingTemplatesAdminClient from "./OnboardingTemplatesAdminClient";

export default async function OnboardingTemplatesPage() {
  const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to onboarding templates.
      </div>
    );
  }

  return <OnboardingTemplatesAdminClient />;
}

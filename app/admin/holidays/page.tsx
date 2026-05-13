import { currentUserHasAnyRole } from "../../../lib/auth/access";
import HolidaysAdminClient from "./HolidaysAdminClient";

export default async function HolidaysAdminPage() {
  const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to company holiday settings.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Company Holidays</h1>
        <p className="mt-1 text-sm text-slate-600">
          Manage the holiday calendar MFN uses to exclude non-working days from PTO requests.
        </p>
      </div>

      <HolidaysAdminClient />
    </div>
  );
}

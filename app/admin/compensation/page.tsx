import { canCurrentUserManageCompensation } from "../../../lib/auth/access";
import CompensationAdminClient from "./CompensationAdminClient";

export default async function CompensationAdminPage() {
  const allowed = await canCurrentUserManageCompensation();

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to compensation management.
      </div>
    );
  }

  return <CompensationAdminClient />;
}
import { canCurrentUserManageAccrualOverride } from "../../../lib/auth/access";
import AccrualOverrideClient from "./AccrualOverrideClient";

export default async function AccrualOverridePage() {
  const allowed = await canCurrentUserManageAccrualOverride();

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to accrual overrides.
      </div>
    );
  }

  return <AccrualOverrideClient />;
}
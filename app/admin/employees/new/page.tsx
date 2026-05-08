import { currentUserHasAnyRole } from "../../../../lib/auth/access";
import AddEmployeeClient from "./AddEmployeeClient";

export default async function AddEmployeePage() {
  const allowed = await currentUserHasAnyRole(["SITE_ADMIN", "HR_ADMIN"]);

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to add employees.
      </div>
    );
  }

  return <AddEmployeeClient />;
}
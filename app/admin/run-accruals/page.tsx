import { canCurrentUserRunAccruals } from "../../../lib/auth/access";
import RunAccrualsClient from "./RunAccrualsClient";

export default async function RunAccrualsPage() {
  const allowed = await canCurrentUserRunAccruals();

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to run monthly accruals.
      </div>
    );
  }

  return <RunAccrualsClient />;
}
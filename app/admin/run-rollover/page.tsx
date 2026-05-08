import { canCurrentUserRunRollover } from "../../../lib/auth/access";
import RunRolloverClient from "./RunRolloverClient";

export default async function RunRolloverPage() {
  const allowed = await canCurrentUserRunRollover();

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to run year-end rollover.
      </div>
    );
  }

  return <RunRolloverClient />;
}
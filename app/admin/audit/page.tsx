import { canCurrentUserViewAudit } from "../../../lib/auth/access";
import AuditLogClient from "./AuditLogClient";

export default async function AuditLogPage() {
  const allowed = await canCurrentUserViewAudit();

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to the audit log.
      </div>
    );
  }

  return <AuditLogClient />;
}
import { canCurrentUserManageDocumentAcknowledgements } from "../../../lib/auth/access";
import DocumentAcknowledgementsAdminClient from "./DocumentAcknowledgementsAdminClient";

export default async function DocumentAcknowledgementsPage() {
  const allowed = await canCurrentUserManageDocumentAcknowledgements();

  if (!allowed) {
    return (
      <div className="text-red-600">
        You do not have access to document acknowledgements.
      </div>
    );
  }

  return <DocumentAcknowledgementsAdminClient />;
}

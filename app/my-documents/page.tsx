import { getCurrentUser } from "../../lib/auth/current-user";
import MyDocumentsClient from "./MyDocumentsClient";

export default async function MyDocumentsPage() {
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return <div className="text-red-600">No current user found.</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">My Documents</h2>
        <p className="mt-1 text-sm text-slate-600">
          View and download documents linked to your employee record.
        </p>
      </div>

      <MyDocumentsClient employeeId={currentUser.id} />
    </div>
  );
}

import { auth } from "../../auth";
import { redirect } from "next/navigation";
import ReportsClient from "./ReportsClient";
import { getCurrentUser } from "../../lib/auth/current-user";
import { getEmployeeRoles } from "../../lib/auth/permissions";

export default async function ReportsPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const currentUser = await getCurrentUser();
  const roles = currentUser ? await getEmployeeRoles(currentUser.id) : [];
  const canSeeReportingStructure =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");
  const canSeeEmployeeMaster =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");
  const canSeeUserAccess =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");
  const canSeeJobChanges =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");
  const canSeeDocumentAcknowledgements =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");
  const canSeePtoLedger =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");
  const canSeePtoLiability =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");
  const canSeeAuditLog =
    roles.includes("SITE_ADMIN") || roles.includes("HR_ADMIN");

  return (
    <ReportsClient
      canSeeReportingStructure={canSeeReportingStructure}
      canSeeEmployeeMaster={canSeeEmployeeMaster}
      canSeeUserAccess={canSeeUserAccess}
      canSeeJobChanges={canSeeJobChanges}
      canSeeDocumentAcknowledgements={canSeeDocumentAcknowledgements}
      canSeePtoLedger={canSeePtoLedger}
      canSeePtoLiability={canSeePtoLiability}
      canSeeAuditLog={canSeeAuditLog}
    />
  );
}

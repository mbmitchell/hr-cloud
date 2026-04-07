import { getCurrentUser } from "../../lib/auth/current-user";
import { getEmployeeRoles } from "../../lib/auth/permissions";
import { canCurrentUserAccessAdjustmentsPage } from "../../lib/auth/access";
import SidebarClient from "./sidebar-client";
import { buildSidebarSections } from "./sidebar-nav";

export default async function Sidebar({
  mobile = false,
}: {
  mobile?: boolean;
}) {
  const user = await getCurrentUser();

  let roles: string[] = [];

  if (user) {
    roles = await getEmployeeRoles(user.id);
  }

  const isSiteAdmin = roles.includes("SITE_ADMIN");
  const isHrAdmin = roles.includes("HR_ADMIN");
  const isAccounting = roles.includes("ACCOUNTING");
  const isManager = roles.includes("MANAGER");
  const isAuditor = roles.includes("AUDITOR");
  const isExecutive = roles.includes("EXECUTIVE_READONLY");

  const canSeeCompensation = isSiteAdmin || isHrAdmin || isAccounting;
  const canSeeReports =
    isSiteAdmin || isHrAdmin || isAccounting || isExecutive;
  const canSeeApprovals = isSiteAdmin || isHrAdmin || isManager;
  const canSeeAdjustments = user
    ? await canCurrentUserAccessAdjustmentsPage()
    : false;
  const canSeeAudit = isSiteAdmin || isHrAdmin || isAuditor;
  const canSeePolicy = isSiteAdmin || isHrAdmin;
  const canAddEmployees = isSiteAdmin || isHrAdmin;
  const canSeeAuthDiagnostics = isSiteAdmin || isHrAdmin;

  const sections = buildSidebarSections({
    canSeeApprovals,
    canAddEmployees,
    canSeeAdjustments,
    canSeePolicy,
    canSeeCompensation,
    canSeeAuthDiagnostics,
    canSeeReports,
    canSeeAudit,
    isSiteAdmin,
  });

  return <SidebarClient sections={sections} mobile={mobile} />;
}

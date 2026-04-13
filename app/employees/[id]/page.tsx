import Link from "next/link";

import { getCurrentUser } from "../../../lib/auth/current-user";
import { getEmployeeRoles, isManagerOf } from "../../../lib/auth/permissions";
import { getEmployeeProfilePageData } from "../../../lib/server/employees/employee-queries";
import {
  getActiveOnboardingTemplates,
  getEmployeeOnboardingSummary,
} from "../../../lib/server/onboarding";
import {
  getActiveOffboardingTemplates,
  getEmployeeOffboardingSummary,
} from "../../../lib/server/offboarding/offboarding-queries";
import { requireDocumentAcknowledgementActor } from "../../../lib/server/document-acknowledgements/access";
import { getEmployeeDocumentAcknowledgementSummary } from "../../../lib/server/document-acknowledgements/queries";
import EmployeeActivityTab from "./EmployeeActivityTab";
import EmployeeAdminTab from "./EmployeeAdminTab";
import EmployeeDocumentsTab from "./EmployeeDocumentsTab";
import EmployeeLifecycleTab from "./EmployeeLifecycleTab";
import EmployeeProfileTab from "./EmployeeProfileTab";
import EmployeePtoTab from "./EmployeePtoTab";
import EmployeeTabNav, { type EmployeeTabItem } from "./EmployeeTabNav";

type SearchParams = Promise<{
  tab?: string;
}>;

function formatDate(value: Date) {
  return new Date(value).toLocaleDateString();
}

function getMonthlyAccrualRateForDisplay(params: {
  hireDate: Date;
  monthlyAccrualOverride?: number | null;
  asOfDate?: Date;
}) {
  if (params.monthlyAccrualOverride != null) {
    return params.monthlyAccrualOverride;
  }

  const asOfDate = params.asOfDate ?? new Date();
  let years = asOfDate.getFullYear() - params.hireDate.getFullYear();

  if (
    asOfDate.getMonth() < params.hireDate.getMonth() ||
    (asOfDate.getMonth() === params.hireDate.getMonth() &&
      asOfDate.getDate() < params.hireDate.getDate())
  ) {
    years -= 1;
  }

  if (years <= 5) return 10.0;
  if (years <= 10) return 13.33;
  return 16.67;
}

export default async function EmployeeProfilePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const resolvedSearchParams = await searchParams;

  const currentUser = await getCurrentUser();

  if (!currentUser) {
    return <div className="text-red-600">No current user found.</div>;
  }

  const currentUserRoles = await getEmployeeRoles(currentUser.id);
  const isAdmin =
    currentUserRoles.includes("SITE_ADMIN") ||
    currentUserRoles.includes("HR_ADMIN");
  const isExecutive = currentUserRoles.includes("EXECUTIVE_READONLY");
  const isAuditor = currentUserRoles.includes("AUDITOR");
  const isManager = currentUserRoles.includes("MANAGER");

  const isSelf = currentUser.id === id;
  const managesEmployee = isManager ? await isManagerOf(currentUser.id, id) : false;

  const canViewProfile =
    isSelf || isAdmin || isExecutive || isAuditor || managesEmployee;
  const canViewDocuments = isSelf || isAdmin;

  if (!canViewProfile) {
    return (
      <div className="text-red-600">
        You do not have permission to view this employee profile.
      </div>
    );
  }

  const { employee, managerOptions, allRoles, statusHistoryEntries } =
    await getEmployeeProfilePageData({
      employeeId: id,
      includeAdminOptions: isAdmin,
    });

  if (!employee) {
    return <div className="text-red-600">Employee not found.</div>;
  }

  const ptoLedger = employee.ledger.filter((entry) => entry.bucket === "PTO");
  const compLedger = employee.ledger.filter((entry) => entry.bucket === "COMP");

  const currentPtoBalance = ptoLedger[0]?.balance ?? 0;
  const currentCompBalance = compLedger[0]?.balance ?? 0;

  const monthlyAccrualRate = getMonthlyAccrualRateForDisplay({
    hireDate: employee.hireDate,
    monthlyAccrualOverride: employee.monthlyAccrualOverride,
  });

  const visibleRequests = employee.requests.slice(0, 10);
  const visibleLedger = employee.ledger.slice(0, 20);
  const directReports = employee.directReports;
  const acknowledgementActor = isAdmin
    ? await requireDocumentAcknowledgementActor()
    : null;

  const [
    onboardingSummary,
    activeOnboardingTemplates,
    offboardingSummary,
    activeOffboardingTemplates,
    acknowledgementSummary,
  ] = await Promise.all([
    getEmployeeOnboardingSummary(employee.id),
    isAdmin ? getActiveOnboardingTemplates() : Promise.resolve([]),
    isAdmin ? getEmployeeOffboardingSummary(employee.id) : Promise.resolve(null),
    isAdmin ? getActiveOffboardingTemplates() : Promise.resolve([]),
    acknowledgementActor
      ? getEmployeeDocumentAcknowledgementSummary(acknowledgementActor, employee.id)
      : Promise.resolve(null),
  ]);

  const roleCodes = employee.roleAssignments.map(
    (assignment) => assignment.role.code
  );

  const tabs: EmployeeTabItem[] = [
    {
      id: "profile",
      label: "Profile",
      href: `/employees/${employee.id}?tab=profile`,
    },
    {
      id: "pto",
      label: "PTO",
      href: `/employees/${employee.id}?tab=pto`,
    },
    ...(canViewDocuments
      ? [
          {
            id: "documents",
            label: "Documents",
            href: `/employees/${employee.id}?tab=documents`,
          },
        ]
      : []),
    {
      id: "lifecycle",
      label: "Onboarding / Offboarding",
      href: `/employees/${employee.id}?tab=lifecycle`,
    },
    {
      id: "activity",
      label: "History / Activity",
      href: `/employees/${employee.id}?tab=activity`,
    },
    ...(isAdmin
      ? [
          {
            id: "admin",
            label: "Admin",
            href: `/employees/${employee.id}?tab=admin`,
          },
        ]
      : []),
  ];

  const activeTab = tabs.some((tab) => tab.id === resolvedSearchParams.tab)
    ? (resolvedSearchParams.tab as string)
    : tabs[0].id;

  let activeTabContent;

  switch (activeTab) {
    case "pto":
      activeTabContent = (
        <EmployeePtoTab
          currentPtoBalance={currentPtoBalance}
          currentCompBalance={currentCompBalance}
          monthlyAccrualRate={monthlyAccrualRate}
          monthlyAccrualOverride={employee.monthlyAccrualOverride}
          accrualOverrideReason={employee.accrualOverrideReason}
          visibleRequests={visibleRequests}
        />
      );
      break;
    case "documents":
      activeTabContent = canViewDocuments ? (
        <EmployeeDocumentsTab
          employeeId={employee.id}
          canUpload={isAdmin}
          canManage={isAdmin}
          acknowledgementSummary={acknowledgementSummary}
        />
      ) : null;
      break;
    case "lifecycle":
      activeTabContent = (
        <EmployeeLifecycleTab
          employeeId={employee.id}
          onboarding={
            onboardingSummary
              ? {
                  id: onboardingSummary.id,
                  status: onboardingSummary.status,
                  templateName: onboardingSummary.template?.name ?? null,
                  totalCount: onboardingSummary.summary.totalCount,
                  completedCount: onboardingSummary.summary.completedCount,
                  pendingCount: onboardingSummary.summary.pendingCount,
                  nextDueDate: onboardingSummary.summary.nextDueDate
                    ? formatDate(onboardingSummary.summary.nextDueDate)
                    : null,
                }
              : null
          }
          activeOnboardingTemplates={activeOnboardingTemplates}
          offboarding={
            offboardingSummary
              ? {
                  id: offboardingSummary.id,
                  status: offboardingSummary.status,
                  separationType: offboardingSummary.separationType,
                  terminationDate: formatDate(offboardingSummary.terminationDate),
                  completionPercentage:
                    offboardingSummary.progress.completionPercentage,
                  totalTasks: offboardingSummary.progress.totalTasks,
                  completedTasks: offboardingSummary.progress.completedTasks,
                }
              : null
          }
          activeOffboardingTemplates={activeOffboardingTemplates}
          canCreate={isAdmin}
        />
      );
      break;
    case "activity":
      activeTabContent = (
        <EmployeeActivityTab
          statusHistoryEntries={statusHistoryEntries}
          visibleLedger={visibleLedger}
        />
      );
      break;
    case "admin":
      activeTabContent = isAdmin ? (
        <EmployeeAdminTab
          employee={{
            id: employee.id,
            firstName: employee.firstName,
            lastName: employee.lastName,
            email: employee.email,
            department: employee.department,
            title: employee.title,
            status: employee.status,
            hireDate: employee.hireDate.toISOString().split("T")[0],
            managerId: employee.managerId,
          }}
          managers={managerOptions}
          roles={allRoles.map((role) => ({
            id: role.id,
            code: role.code,
            name: role.name,
          }))}
          assignedRoleCodes={roleCodes}
        />
      ) : null;
      break;
    case "profile":
    default:
      activeTabContent = (
        <EmployeeProfileTab
          employee={{
            email: employee.email,
            status: employee.status,
            department: employee.department,
            title: employee.title,
            hireDate: employee.hireDate,
            manager: employee.manager
              ? {
                  firstName: employee.manager.firstName,
                  lastName: employee.manager.lastName,
                }
              : null,
          }}
          directReports={directReports}
          roleCodes={roleCodes}
        />
      );
      break;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold">
            {employee.firstName} {employee.lastName}
          </h2>
          <div className="mt-1 text-sm text-slate-600">
            {employee.title ?? "No title"} • {employee.department ?? "No department"}
          </div>
        </div>

        <Link
          href="/employees"
          className="inline-flex w-full items-center justify-center rounded border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 sm:w-auto"
        >
          Back to Employees
        </Link>
      </div>

      <EmployeeTabNav tabs={tabs} activeTab={activeTab} />

      {activeTabContent}
    </div>
  );
}

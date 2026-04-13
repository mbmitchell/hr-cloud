import Link from "next/link";

import { getCurrentUser } from "../../../lib/auth/current-user";
import { getEmployeeRoles, isManagerOf } from "../../../lib/auth/permissions";
import { getPolicySettings } from "../../../lib/policy/settings";
import { getAccrualSummary } from "../../../lib/pto/accrual";
import { calculatePerPaycheckWithholding } from "../../../lib/server/employees/benefits";
import {
  calculateTotalCompensationSummary,
  serializeCompensationProfile,
} from "../../../lib/server/employees/compensation";
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
import EmployeeBenefitsTab from "./EmployeeBenefitsTab";
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
  const canViewPrivateInfo = isSelf || isAdmin;
  const canViewBenefits = isSelf || isAdmin;

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
      includePrivateInfo: canViewPrivateInfo,
      includeBenefits: canViewBenefits,
    });
  const policy = await getPolicySettings();

  if (!employee) {
    return <div className="text-red-600">Employee not found.</div>;
  }

  const ptoLedger = employee.ledger.filter((entry) => entry.bucket === "PTO");
  const compLedger = employee.ledger.filter((entry) => entry.bucket === "COMP");

  const currentPtoBalance = ptoLedger[0]?.balance ?? 0;
  const currentCompBalance = compLedger[0]?.balance ?? 0;

  const accrualSummary = getAccrualSummary({
    hireDate: employee.hireDate,
    accrualMode: employee.accrualMode,
    monthlyAccrualOverride: employee.monthlyAccrualOverride,
    accrualOverrideReason: employee.accrualOverrideReason,
    advancedAccrualTier: employee.advancedAccrualTier,
    advancedAccrualEffectiveDate: employee.advancedAccrualEffectiveDate,
    advancedAccrualReason: employee.advancedAccrualReason,
  }, new Date(), policy);

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
  const compensationProfile = serializeCompensationProfile({
    id: employee.id,
    firstName: employee.firstName,
    lastName: employee.lastName,
    payType: employee.payType,
    hourlyRate: employee.hourlyRate,
    annualSalary: employee.annualSalary,
    fte: employee.fte,
    payrollFrequency: employee.payrollFrequency,
    hireDate: employee.hireDate,
    compensationProfile:
      "compensationProfile" in employee ? employee.compensationProfile : null,
  });
  const totalCompensationSummary = calculateTotalCompensationSummary({
    compensationProfile,
    benefitElections:
      "benefitElections" in employee
        ? employee.benefitElections.map((election) => ({
            electionStatus: election.electionStatus,
            companyMonthlyCost: election.companyMonthlyCost,
          }))
        : [],
  });

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
    ...(canViewBenefits
      ? [
          {
            id: "benefits",
            label: "Benefits",
            href: `/employees/${employee.id}?tab=benefits`,
          },
        ]
      : []),
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
    case "benefits":
      activeTabContent = canViewBenefits ? (
        <EmployeeBenefitsTab
          employeeId={employee.id}
          payrollFrequency={employee.payrollFrequency}
          elections={
            "benefitElections" in employee
              ? employee.benefitElections.map((election) => ({
                  id: election.id,
                  benefitType: election.benefitType,
                  planName: election.planName,
                  coverageLevel: election.coverageLevel,
                  electionStatus: election.electionStatus,
                  effectiveDate: election.effectiveDate.toISOString().split("T")[0],
                  totalMonthlyCost: election.totalMonthlyCost.toFixed(2),
                  companyMonthlyCost: election.companyMonthlyCost.toFixed(2),
                  employeeMonthlyCost: election.employeeMonthlyCost.toFixed(2),
                  estimatedPerPaycheckWithholding:
                    election.electionStatus === "ENROLLED"
                      ? calculatePerPaycheckWithholding(
                          election.employeeMonthlyCost,
                          employee.payrollFrequency
                        )
                      : null,
                  payrollFrequency: employee.payrollFrequency,
                  notes: election.notes,
                }))
              : []
          }
          canManage={isAdmin}
        />
      ) : null;
      break;
    case "pto":
      activeTabContent = (
        <EmployeePtoTab
          currentPtoBalance={currentPtoBalance}
          currentCompBalance={currentCompBalance}
          accrualSummary={accrualSummary}
          monthlyAccrualOverride={employee.monthlyAccrualOverride}
          accrualOverrideReason={employee.accrualOverrideReason}
          advancedAccrualTier={employee.advancedAccrualTier}
          advancedAccrualEffectiveDate={employee.advancedAccrualEffectiveDate}
          advancedAccrualReason={employee.advancedAccrualReason}
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
            payrollFrequency: employee.payrollFrequency,
            compensationProfile,
            totalCompensationSummary,
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
          employeeId={employee.id}
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
          contactInfo={
            canViewPrivateInfo && "contactInfo" in employee
              ? employee.contactInfo
              : null
          }
          emergencyContacts={
            canViewPrivateInfo && "emergencyContacts" in employee
              ? employee.emergencyContacts
              : []
          }
          canViewPrivateInfo={canViewPrivateInfo}
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

export type SidebarIconName =
  | "home"
  | "request"
  | "calendar"
  | "checklist"
  | "team"
  | "people"
  | "userPlus"
  | "settings"
  | "adjustments"
  | "money"
  | "clock"
  | "shield"
  | "chart"
  | "audit";

export type SidebarNavItem = {
  href: string;
  label: string;
  icon: SidebarIconName;
};

export type SidebarNavSection = {
  id: string;
  title: string;
  items: SidebarNavItem[];
};

function item(
  href: string,
  label: string,
  icon: SidebarIconName
): SidebarNavItem {
  return { href, label, icon };
}

type BuildSidebarSectionsInput = {
  canSeeMyDocuments: boolean;
  canSeeMyAcknowledgements: boolean;
  canSeeApprovals: boolean;
  canAddEmployees: boolean;
  canSeeOnboarding: boolean;
  canSeeOffboarding: boolean;
  canManageOnboardingTemplates: boolean;
  canManageOffboardingTemplates: boolean;
  canManageDocumentAcknowledgements: boolean;
  canSeeAdjustments: boolean;
  canSeePolicy: boolean;
  canSeeCompensation: boolean;
  canSeeAuthDiagnostics: boolean;
  canSeeReports: boolean;
  canSeeAudit: boolean;
  canSeeNotifications: boolean;
  isSiteAdmin: boolean;
};

export function buildSidebarSections(
  input: BuildSidebarSectionsInput
): SidebarNavSection[] {
  return [
    {
      id: "home",
      title: "Home",
      items: [item("/", "Dashboard", "home")],
    },
    {
      id: "my-time",
      title: "My Time",
      items: [
        item("/pto/request", "Request Time Off", "request"),
        item("/pto/requests", "My Requests", "checklist"),
        item("/calendar", "PTO Calendar", "calendar"),
        ...(input.canSeeMyDocuments
          ? [item("/my-documents", "My Documents", "checklist")]
          : []),
        ...(input.canSeeMyAcknowledgements
          ? [item("/my-acknowledgements", "My Acknowledgements", "checklist")]
          : []),
      ],
    },
    {
      id: "team",
      title: "Team",
      items: [
        ...(input.canSeeApprovals
          ? [
              item("/dashboard/approvals", "Approvals", "team"),
            ]
          : []),
      ],
    },
    {
      id: "people",
      title: "People",
      items: [
        item("/employees", "Employees", "people"),
        ...(input.canSeeOnboarding
          ? [item("/onboarding", "Onboarding", "checklist")]
          : []),
        ...(input.canSeeOffboarding
          ? [item("/offboarding", "Offboarding", "checklist")]
          : []),
        ...(input.canAddEmployees
          ? [item("/admin/employees/new", "Add Employee", "userPlus")]
          : []),
      ],
    },
    {
      id: "administration",
      title: "Administration",
      items: [
        ...(input.canSeeAdjustments
          ? [item("/admin/adjustments", "PTO Adjustments", "adjustments")]
          : []),
        ...(input.canSeePolicy
          ? [item("/admin/policy", "Settings", "settings")]
          : []),
        ...(input.canManageOnboardingTemplates
          ? [item("/admin/onboarding/templates", "Onboarding Templates", "checklist")]
          : []),
        ...(input.canManageOffboardingTemplates
          ? [item("/admin/offboarding/templates", "Offboarding Templates", "checklist")]
          : []),
        ...(input.canManageDocumentAcknowledgements
          ? [item("/admin/document-acknowledgements", "Document Acknowledgements", "checklist")]
          : []),
        ...(input.canSeeAdjustments
          ? [item("/admin/accrual-override", "Accrual Settings", "clock")]
          : []),
        ...(input.canSeeCompensation
          ? [item("/admin/compensation", "Compensation", "money")]
          : []),
        ...(input.isSiteAdmin
          ? [item("/admin/run-accruals", "Monthly Accrual", "clock")]
          : []),
        ...(input.isSiteAdmin
          ? [item("/admin/run-rollover", "Year-End Rollover", "clock")]
          : []),
        ...(input.canSeeAuthDiagnostics
          ? [item("/admin/auth", "Auth Diagnostics", "shield")]
          : []),
      ],
    },
    {
      id: "reports",
      title: "Reports",
      items: [
        ...(input.canSeeReports
          ? [item("/reports", "Reports", "chart")]
          : []),
        ...(input.canSeeAudit
          ? [item("/admin/audit", "Audit Log", "audit")]
          : []),
        ...(input.canSeeNotifications
          ? [item("/admin/notifications", "Notifications", "audit")]
          : []),
      ],
    },
  ].filter((section) => section.items.length > 0);
}

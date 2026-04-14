export type ReportNoteDefinition = {
  label: string;
  text: string;
};

export type ReportNotesConfig = {
  title: string;
  subtitle: string;
  purpose: string;
  sourceOfTruth: string;
  definitions: ReportNoteDefinition[];
  filterExportNote: string;
};

export const reportingStructureReportNotes: ReportNotesConfig = {
  title: "Reporting Structure",
  subtitle: "Manager hierarchy and employee reporting lines",
  purpose:
    "Review the current manager hierarchy and employee reporting lines for HR operations and audit support.",
  sourceOfTruth:
    "Current employee records, current manager assignments, and current active role assignments.",
  definitions: [
    {
      label: "Managers",
      text: "Employees with at least one current direct report in the current employee dataset.",
    },
    {
      label: "Missing Manager",
      text: "Active employees without a current manager assignment, excluding top-level admin exceptions in the report logic.",
    },
    {
      label: "Current State",
      text: "This report reflects current employee relationships only and does not use historical job change data.",
    },
  ],
  filterExportNote:
    "Current filters affect both the on-screen table and exported files. The report reflects current employee state at the time it is run.",
};

export const employeeMasterReportNotes: ReportNotesConfig = {
  title: "Employee Master Report",
  subtitle: "Current employee roster and core employment data",
  purpose:
    "Review the current employee roster and core employment data for HR operations and audit support.",
  sourceOfTruth: "Current employee records and current active role assignments.",
  definitions: [
    {
      label: "Current Roster",
      text: "This report reflects current employee roster state only and does not use historical workflow records as the primary source.",
    },
    {
      label: "Role",
      text: "Role values reflect current active role assignments at the time the report is generated.",
    },
    {
      label: "Missing Manager",
      text: "The missing-manager count is based on current employee state and excludes top-level admin exceptions where applicable.",
    },
  ],
  filterExportNote:
    "Current filters affect both the on-screen table and exported files. The report reflects current employee data at the time it is run.",
};

export const userAccessReportNotes: ReportNotesConfig = {
  title: "User Access / Role Report",
  subtitle: "Current employee access roster and assigned system roles",
  purpose:
    "Review the current employee access roster and active role assignments for HR and admin control review.",
  sourceOfTruth:
    "Current employee records plus current active role assignments.",
  definitions: [
    {
      label: "Elevated",
      text: "Current access includes elevated administrative roles such as HR_ADMIN or SITE_ADMIN.",
    },
    {
      label: "Manager / Standard",
      text: "Manager means the user has MANAGER without an elevated admin role. Standard means non-elevated standard access.",
    },
    {
      label: "Missing Role",
      text: "No active role assignment exists for the employee in the current access dataset.",
    },
  ],
  filterExportNote:
    "Current filters affect both the on-screen table and exported files. The report reflects current access state when it is generated.",
};

export const jobChangeHistoryReportNotes: ReportNotesConfig = {
  title: "Job Change History Report",
  subtitle: "Structured employee change requests and status history",
  purpose:
    "Review structured employment change requests and their workflow status history for HR and audit use.",
  sourceOfTruth:
    "EmployeeChangeRequest records and their related employee, requester, reviewer, and document references.",
  definitions: [
    {
      label: "Source of Truth",
      text: "This report is history-based and uses EmployeeChangeRequest rather than current employee state as its primary source.",
    },
    {
      label: "Base Date Filter",
      text: "The primary date range filter uses createdAt so draft and submitted requests can be reviewed consistently.",
    },
    {
      label: "Change Summary",
      text: "Change Summary is derived from changed field keys and shown as a readable field list instead of raw JSON.",
    },
  ],
  filterExportNote:
    "Current filters affect both the on-screen table and exported files. This report reflects historical workflow records within the selected filter scope.",
};

export const documentAcknowledgementReportNotes: ReportNotesConfig = {
  title: "Document Acknowledgement Report",
  subtitle: "Employee document assignments and acknowledgement status",
  purpose:
    "Review document assignment and acknowledgement status for HR operations and audit evidence.",
  sourceOfTruth:
    "EmployeeDocumentAssignment records and their current document, version, employee, and assignment metadata.",
  definitions: [
    {
      label: "Acknowledged",
      text: "Acknowledged means acknowledgedAt is present for the assignment.",
    },
    {
      label: "Pending",
      text: "Pending means the assignment is not acknowledged and is not currently overdue.",
    },
    {
      label: "Overdue",
      text: "Overdue means the assignment is not acknowledged, dueDate exists, and dueDate is in the past.",
    },
  ],
  filterExportNote:
    "Current filters affect both the on-screen table and exported files. This report reflects assignment history and current acknowledgement state within the selected scope.",
};

export const ptoLedgerReportNotes: ReportNotesConfig = {
  title: "PTO Ledger / Balance Report",
  subtitle: "PTO activity history and current ledger balances",
  purpose:
    "Review PTO ledger activity and running balances for HR administration and audit support.",
  sourceOfTruth:
    "PTOLedger entries for the PTO bucket, with current employee joins for department and status.",
  definitions: [
    {
      label: "Ledger Date",
      text: "The authoritative ledger date in this report is effectiveDate.",
    },
    {
      label: "Aggregate Balance",
      text: "Current aggregate PTO balance is based on the latest PTO ledger balance per employee in the filtered scope.",
    },
    {
      label: "Negative Balance Employees",
      text: "Counts employees whose latest PTO ledger balance is below zero in the filtered scope.",
    },
  ],
  filterExportNote:
    "Current filters affect both the on-screen table and exported files. The report reflects PTO ledger history, while current balance summaries are derived from the latest ledger state in scope.",
};

export const ptoLiabilityReportNotes: ReportNotesConfig = {
  title: "PTO Liability Report",
  subtitle: "Estimated PTO payout exposure for current employee scope",
  purpose:
    "Review estimated PTO payout liability by employee for HR, finance, and audit use without exposing raw balance or compensation inputs.",
  sourceOfTruth:
    "Latest PTO ledger balance per employee from PTOLedger plus the current EmployeeCompensationProfile used for valuation.",
  definitions: [
    {
      label: "Liability Valuation",
      text: "Salaried liability uses annual salary divided by 2080 and multiplied by current PTO hours. Hourly liability uses hourly rate multiplied by current PTO hours.",
    },
    {
      label: "Negative Balance Review",
      text: "Employees with a negative current PTO balance show zero liability and are flagged for review rather than displaying a negative liability amount.",
    },
    {
      label: "Review Required",
      text: "If compensation profile data is missing or incomplete, liability is not guessed, the employee is flagged for review, and the row is excluded from total liability.",
    },
  ],
  filterExportNote:
    "Current filters affect both the on-screen table and exported files. The report reflects current data at run time, and scheduled month-end delivery uses the same liability rules against the current month-end snapshot.",
};

export const auditLogReportNotes: ReportNotesConfig = {
  title: "Audit Log Report",
  subtitle: "System activity and control evidence for HR/admin review",
  purpose:
    "Review system activity and control evidence across HR workflows using the existing audit trail.",
  sourceOfTruth:
    "AuditLog records, with limited employee joins for readable actor and related employee display.",
  definitions: [
    {
      label: "Timestamp",
      text: "The authoritative audit timestamp in this report is AuditLog.createdAt.",
    },
    {
      label: "Outcome",
      text: "Outcome is normalized conservatively from safe payload fields and action names where a clear success or failure concept exists.",
    },
    {
      label: "Actor Availability",
      text: "Some audit events may not map to a named employee actor and can appear with only a stored actor ID or no resolved actor name.",
    },
  ],
  filterExportNote:
    "Current filters affect both the on-screen table and exported files. This report reflects historical audit activity within the selected filter range.",
};

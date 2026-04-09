export const DOCUMENT_ASSIGNMENT_STATUSES = [
  "PENDING",
  "ACKNOWLEDGED",
  "CANCELLED",
] as const;

export const DOCUMENT_ASSIGNMENT_REMINDER_TYPES = [
  "OVERDUE",
  "STALE_PENDING",
] as const;

export const DOCUMENT_ACKNOWLEDGEMENT_ADMIN_ROLES = [
  "SITE_ADMIN",
  "HR_ADMIN",
] as const;

export const POLICY_DOCUMENT_INTERNAL_DESCRIPTION_PREFIX =
  "[POLICY_DOCUMENT_BACKING]";

export type DocumentAssignmentStatus =
  (typeof DOCUMENT_ASSIGNMENT_STATUSES)[number];

export type DocumentAssignmentReminderType =
  (typeof DOCUMENT_ASSIGNMENT_REMINDER_TYPES)[number];

export function isDocumentAssignmentStatus(
  value: string
): value is DocumentAssignmentStatus {
  return DOCUMENT_ASSIGNMENT_STATUSES.includes(
    value as DocumentAssignmentStatus
  );
}

export function isDocumentAssignmentReminderType(
  value: string
): value is DocumentAssignmentReminderType {
  return DOCUMENT_ASSIGNMENT_REMINDER_TYPES.includes(
    value as DocumentAssignmentReminderType
  );
}

export type AssignableDocumentListItem = {
  id: string;
  title: string;
  category: string;
  isActive: boolean;
  currentVersion: {
    id: string;
    versionLabel: string;
    publishedAt: Date;
  } | null;
  assignmentCounts: {
    total: number;
    pending: number;
    acknowledged: number;
    overdue: number;
    completionPercentage: number;
  };
  notificationCounts: {
    failed: number;
  };
  recentFailedNotifications?: Array<{
    id: string;
    employeeName: string;
    versionLabel: string;
    createdAt: Date;
    lastError: string | null;
  }>;
  versions?: Array<{
    id: string;
    versionLabel: string;
    publishedAt: Date;
    employeeDocumentId: string;
    originalFileName: string;
  }>;
};

export type EmployeeDocumentAssignmentListItem = {
  id: string;
  status: string;
  assignedAt: Date;
  dueDate: Date | null;
  viewedAt: Date | null;
  acknowledgedAt: Date | null;
  document: {
    id: string;
    title: string;
    category: string;
  };
  version: {
    id: string;
    versionLabel: string;
    publishedAt: Date;
    employeeDocumentId: string;
    originalFileName: string;
  };
  assignedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
};

export type EmployeeDocumentAcknowledgementSummary = {
  total: number;
  pending: number;
  acknowledged: number;
  overdue: number;
};

export type AssignDocumentInput = {
  actorId: string;
  employeeId?: string;
  employeeIds?: string[];
  assignableDocumentVersionId: string;
  dueDate?: Date | null;
};

export type AssignableEmployeeOption = {
  id: string;
  name: string;
  department: string | null;
  status: string;
};

export function buildPolicyDocumentInternalDescription() {
  return POLICY_DOCUMENT_INTERNAL_DESCRIPTION_PREFIX;
}

export function isPolicyDocumentInternalDescription(value: string | null) {
  return value?.startsWith(POLICY_DOCUMENT_INTERNAL_DESCRIPTION_PREFIX) ?? false;
}

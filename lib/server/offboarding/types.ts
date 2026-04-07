export const OFFBOARDING_ASSIGNEE_TYPES = ["HR", "MANAGER", "IT"] as const;

export const OFFBOARDING_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const OFFBOARDING_TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
] as const;

export const OFFBOARDING_SEPARATION_TYPES = [
  "VOLUNTARY",
  "INVOLUNTARY",
  "RETIREMENT",
  "END_OF_CONTRACT",
  "OTHER",
] as const;

export const OFFBOARDING_ADMIN_ROLES = ["SITE_ADMIN", "HR_ADMIN"] as const;
export const OFFBOARDING_IT_ROLES = ["IT", "IT_ADMIN"] as const;

export type OffboardingAssigneeType =
  (typeof OFFBOARDING_ASSIGNEE_TYPES)[number];

export type OffboardingStatus = (typeof OFFBOARDING_STATUSES)[number];

export type OffboardingTaskStatus =
  (typeof OFFBOARDING_TASK_STATUSES)[number];

export type OffboardingSeparationType =
  (typeof OFFBOARDING_SEPARATION_TYPES)[number];

export function isOffboardingAssigneeType(
  value: string
): value is OffboardingAssigneeType {
  return OFFBOARDING_ASSIGNEE_TYPES.includes(
    value as OffboardingAssigneeType
  );
}

export function isOffboardingTaskStatus(
  value: string
): value is OffboardingTaskStatus {
  return OFFBOARDING_TASK_STATUSES.includes(value as OffboardingTaskStatus);
}

export function isOffboardingSeparationType(
  value: string
): value is OffboardingSeparationType {
  return OFFBOARDING_SEPARATION_TYPES.includes(
    value as OffboardingSeparationType
  );
}

export type OffboardingProgress = {
  totalTasks: number;
  completedTasks: number;
  completionPercentage: number;
};

export type OffboardingEmployeeSummary = {
  id: string;
  firstName: string;
  lastName: string;
  title: string | null;
  department: string | null;
};

export type OffboardingTaskView = {
  id: string;
  title: string;
  description: string | null;
  assigneeType: string;
  dueDate: Date | null;
  status: string;
  sortOrder: number;
  assignedEmployeeId: string | null;
  completedAt: Date | null;
  sourceTemplateTaskId: string | null;
};

export type OffboardingQueueItem = {
  id: string;
  status: string;
  separationType: string;
  terminationDate: Date;
  lastWorkingDate: Date | null;
  createdAt: Date;
  employee: OffboardingEmployeeSummary;
  progress: OffboardingProgress;
};

export type OffboardingDetail = {
  id: string;
  employeeId: string;
  templateId: string | null;
  status: string;
  separationType: string;
  terminationDate: Date;
  lastWorkingDate: Date | null;
  eligibleForRehire: boolean | null;
  notes: string | null;
  completedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee: OffboardingEmployeeSummary & {
    managerId: string | null;
  };
  template: {
    id: string;
    name: string;
  } | null;
  tasks: OffboardingTaskView[];
  progress: OffboardingProgress;
};

export type CreateEmployeeOffboardingInput = {
  actorId: string;
  employeeId: string;
  templateId?: string | null;
  separationType: OffboardingSeparationType;
  terminationDate: Date;
  lastWorkingDate?: Date | null;
  eligibleForRehire?: boolean | null;
  notes?: string | null;
};

export function isOffboardingTemplateTaskInputValid(task: {
  title: string;
  sortOrder: number;
  dueOffsetDays: number | null;
}) {
  return (
    task.title.trim().length > 0 &&
    task.sortOrder >= 0 &&
    (task.dueOffsetDays == null || task.dueOffsetDays >= 0)
  );
}

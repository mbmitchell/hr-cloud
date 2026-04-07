export const ONBOARDING_ASSIGNEE_TYPES = [
  "HR",
  "MANAGER",
  "IT",
  "EMPLOYEE",
] as const;

export const ONBOARDING_STATUSES = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
] as const;

export const ONBOARDING_TASK_STATUSES = [
  "PENDING",
  "IN_PROGRESS",
  "COMPLETED",
  "SKIPPED",
] as const;

export const ONBOARDING_ADMIN_ROLES = ["SITE_ADMIN", "HR_ADMIN"] as const;
export const ONBOARDING_IT_ROLES = ["IT", "IT_ADMIN"] as const;

export type OnboardingAssigneeType =
  (typeof ONBOARDING_ASSIGNEE_TYPES)[number];

export type OnboardingStatus = (typeof ONBOARDING_STATUSES)[number];
export type OnboardingTaskStatus = (typeof ONBOARDING_TASK_STATUSES)[number];

export function isOnboardingAssigneeType(
  value: string
): value is OnboardingAssigneeType {
  return ONBOARDING_ASSIGNEE_TYPES.includes(
    value as OnboardingAssigneeType
  );
}

export function isOnboardingStatus(
  value: string
): value is OnboardingStatus {
  return ONBOARDING_STATUSES.includes(value as OnboardingStatus);
}

export function isOnboardingTaskStatus(
  value: string
): value is OnboardingTaskStatus {
  return ONBOARDING_TASK_STATUSES.includes(value as OnboardingTaskStatus);
}

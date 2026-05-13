-- CreateEnum
CREATE TYPE "EmployeeAccrualMode" AS ENUM ('STANDARD_TENURE', 'ADVANCED_TIER', 'MANUAL_ONLY');

-- CreateEnum
CREATE TYPE "EmployeeAccrualTier" AS ENUM ('YEARS_1_TO_5', 'YEARS_6_TO_10', 'YEARS_11_PLUS');

-- CreateEnum
CREATE TYPE "EmployeeBenefitType" AS ENUM ('MEDICAL', 'DENTAL', 'VISION', 'LIFE', 'OTHER');

-- CreateEnum
CREATE TYPE "EmployeeBenefitElectionStatus" AS ENUM ('ENROLLED', 'WAIVED');

-- CreateEnum
CREATE TYPE "EmployeePayrollFrequency" AS ENUM ('BIWEEKLY', 'SEMI_MONTHLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "EmployeeChangeRequestStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'APPLIED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "EmployeeChangeType" AS ENUM ('COMPENSATION', 'JOB_INFO', 'MANAGER', 'STATUS', 'LOCATION', 'CLASSIFICATION', 'OTHER');

-- CreateEnum
CREATE TYPE "HrNotificationOutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'SENT', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "HrNotificationType" AS ENUM ('USER_INITIATED', 'SYSTEM_GENERATED');

-- CreateEnum
CREATE TYPE "ScheduledJobRunStatus" AS ENUM ('RUNNING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "HrNotificationTemplateKey" AS ENUM ('GENERIC_HR_NOTIFICATION', 'EMPLOYEE_CHANGE_REQUEST_CREATED', 'EMPLOYEE_CHANGE_REQUEST_APPROVED', 'EMPLOYEE_CHANGE_REQUEST_APPLIED');

-- CreateTable
CREATE TABLE "Employee" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "entraOid" TEXT,
    "entraTid" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "hireDate" TIMESTAMP(3) NOT NULL,
    "managerId" TEXT,
    "status" TEXT NOT NULL,
    "employmentClassification" TEXT,
    "workLocation" TEXT,
    "payType" TEXT,
    "hourlyRate" DOUBLE PRECISION,
    "annualSalary" DOUBLE PRECISION,
    "fte" DOUBLE PRECISION DEFAULT 1,
    "payrollFrequency" "EmployeePayrollFrequency" NOT NULL DEFAULT 'BIWEEKLY',
    "accrualMode" "EmployeeAccrualMode" NOT NULL DEFAULT 'STANDARD_TENURE',
    "monthlyAccrualOverride" DOUBLE PRECISION,
    "accrualOverrideReason" TEXT,
    "advancedAccrualTier" "EmployeeAccrualTier",
    "advancedAccrualEffectiveDate" TIMESTAMP(3),
    "advancedAccrualReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Employee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HrNotificationOutbox" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "relatedEntityType" TEXT NOT NULL,
    "relatedEntityId" TEXT NOT NULL,
    "notificationType" "HrNotificationType" NOT NULL DEFAULT 'USER_INITIATED',
    "employeeId" TEXT,
    "recipientEmployeeId" TEXT,
    "recipientEmail" TEXT NOT NULL,
    "templateKey" "HrNotificationTemplateKey" NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "HrNotificationOutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdByEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HrNotificationOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScheduledJobRun" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "runKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "status" "ScheduledJobRunStatus" NOT NULL DEFAULT 'RUNNING',
    "recordsProcessed" INTEGER,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScheduledJobRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeChangeRequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "status" "EmployeeChangeRequestStatus" NOT NULL DEFAULT 'DRAFT',
    "changeType" "EmployeeChangeType" NOT NULL,
    "requestedByEmployeeId" TEXT NOT NULL,
    "reviewedByEmployeeId" TEXT,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "requestedEffectiveDate" TIMESTAMP(3) NOT NULL,
    "actualEffectiveDate" TIMESTAMP(3),
    "reason" TEXT,
    "notes" TEXT,
    "relatedDocumentId" TEXT,
    "oldValues" JSONB NOT NULL,
    "newValues" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeChangeRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCompensationProfile" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payType" TEXT NOT NULL,
    "annualSalary" DECIMAL(12,2),
    "hourlyRate" DECIMAL(10,2),
    "standardHours" DECIMAL(5,2) NOT NULL,
    "payrollFrequency" "EmployeePayrollFrequency" NOT NULL DEFAULT 'BIWEEKLY',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeCompensationProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeCompensationHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "payType" TEXT NOT NULL,
    "annualSalary" DECIMAL(12,2),
    "hourlyRate" DECIMAL(10,2),
    "standardHours" DECIMAL(5,2) NOT NULL,
    "payrollFrequency" "EmployeePayrollFrequency" NOT NULL DEFAULT 'BIWEEKLY',
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeCompensationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeBenefitElection" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "benefitType" "EmployeeBenefitType" NOT NULL,
    "planName" TEXT NOT NULL,
    "coverageLevel" TEXT,
    "electionStatus" "EmployeeBenefitElectionStatus" NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "totalMonthlyCost" DECIMAL(10,2) NOT NULL,
    "companyMonthlyCost" DECIMAL(10,2) NOT NULL,
    "employeeMonthlyCost" DECIMAL(10,2) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeBenefitElection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeContactInfo" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "preferredName" TEXT,
    "personalEmail" TEXT,
    "mobilePhone" TEXT,
    "homePhone" TEXT,
    "street1" TEXT,
    "street2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeContactInfo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeEmergencyContact" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeEmergencyContact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTORequest" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "leaveType" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL,
    "approverId" TEXT,
    "graphCalendarEventId" TEXT,
    "notes" TEXT,
    "approvalComment" TEXT,
    "decisionAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PTORequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTORequestAction" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actionById" TEXT,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PTORequestAction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PTOLedger" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "hours" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "sourceRequestId" TEXT,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PTOLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeStatusHistory" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "previousStatus" TEXT NOT NULL,
    "newStatus" TEXT NOT NULL,
    "changedByEmployeeId" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmployeeStatusHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "storedFileName" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSizeBytes" INTEGER NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "uploadedByEmployeeId" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignableDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "currentVersionId" TEXT,
    "createdByEmployeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignableDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignableDocumentVersion" (
    "id" TEXT NOT NULL,
    "assignableDocumentId" TEXT NOT NULL,
    "versionLabel" TEXT NOT NULL,
    "employeeDocumentId" TEXT NOT NULL,
    "notes" TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL,
    "createdByEmployeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssignableDocumentVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeDocumentAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "assignableDocumentId" TEXT NOT NULL,
    "assignableDocumentVersionId" TEXT NOT NULL,
    "assignmentSourceType" TEXT NOT NULL DEFAULT 'DIRECT',
    "sourceEmployeeOnboardingTaskRequirementId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "assignedByEmployeeId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3),
    "viewedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeDocumentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAssignmentEmailOutbox" (
    "id" TEXT NOT NULL,
    "employeeDocumentAssignmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hrNotificationOutboxId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAssignmentEmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentAssignmentReminderEmailOutbox" (
    "id" TEXT NOT NULL,
    "employeeDocumentAssignmentId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "hrNotificationOutboxId" TEXT,
    "reminderType" TEXT NOT NULL,
    "reminderDay" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentAssignmentReminderEmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeType" TEXT NOT NULL,
    "dueOffsetDays" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTemplateTaskDocumentRequirement" (
    "id" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "documentCategory" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplateTaskDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOnboarding" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" TEXT NOT NULL,
    "startDate" TIMESTAMP(3),
    "targetCompletionDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdByEmployeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOnboardingTask" (
    "id" TEXT NOT NULL,
    "employeeOnboardingId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeType" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedByEmployeeId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "sourceTemplateTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeOnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOnboardingTaskDocumentRequirement" (
    "id" TEXT NOT NULL,
    "employeeOnboardingTaskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "documentCategory" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "linkedEmployeeDocumentId" TEXT,
    "linkedAt" TIMESTAMP(3),
    "linkedByEmployeeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeOnboardingTaskDocumentRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTemplateTaskAcknowledgementRequirement" (
    "id" TEXT NOT NULL,
    "templateTaskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assignableDocumentId" TEXT NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingTemplateTaskAcknowledgementRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOnboardingTaskAcknowledgementRequirement" (
    "id" TEXT NOT NULL,
    "employeeOnboardingTaskId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "assignableDocumentId" TEXT NOT NULL,
    "assignedDocumentVersionId" TEXT,
    "employeeDocumentAssignmentId" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeOnboardingTaskAcknowledgementRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OffboardingTemplateTask" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeType" TEXT NOT NULL,
    "dueOffsetDays" INTEGER,
    "sortOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OffboardingTemplateTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOffboarding" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT,
    "status" TEXT NOT NULL,
    "separationType" TEXT NOT NULL,
    "terminationDate" TIMESTAMP(3) NOT NULL,
    "lastWorkingDate" TIMESTAMP(3),
    "eligibleForRehire" BOOLEAN,
    "notes" TEXT,
    "createdByEmployeeId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeOffboarding_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeOffboardingTask" (
    "id" TEXT NOT NULL,
    "employeeOffboardingId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeType" TEXT NOT NULL,
    "assignedEmployeeId" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "completedByEmployeeId" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "sourceTemplateTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeOffboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmployeeRoleAssignment" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "effectiveStartDate" TIMESTAMP(3),
    "effectiveEndDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmployeeRoleAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PolicySettings" (
    "id" TEXT NOT NULL,
    "accrualRate0To5" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "accrualRate6To10" DOUBLE PRECISION NOT NULL DEFAULT 13.33,
    "accrualRateOver10" DOUBLE PRECISION NOT NULL DEFAULT 16.67,
    "rolloverCapHours" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PolicySettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "emp_email_key" ON "Employee"("email");

-- CreateIndex
CREATE INDEX "emp_mgr_idx" ON "Employee"("managerId");

-- CreateIndex
CREATE UNIQUE INDEX "emp_entra_key" ON "Employee"("entraTid", "entraOid");

-- CreateIndex
CREATE INDEX "hno_stat_created_idx" ON "HrNotificationOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "hno_type_stat_created_idx" ON "HrNotificationOutbox"("notificationType", "status", "createdAt");

-- CreateIndex
CREATE INDEX "hno_event_stat_idx" ON "HrNotificationOutbox"("eventType", "status");

-- CreateIndex
CREATE INDEX "hno_rel_ent_idx" ON "HrNotificationOutbox"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "hno_emp_idx" ON "HrNotificationOutbox"("employeeId");

-- CreateIndex
CREATE INDEX "hno_rcpt_emp_idx" ON "HrNotificationOutbox"("recipientEmployeeId");

-- CreateIndex
CREATE INDEX "hno_created_by_idx" ON "HrNotificationOutbox"("createdByEmployeeId");

-- CreateIndex
CREATE UNIQUE INDEX "sjr_runkey_key" ON "ScheduledJobRun"("runKey");

-- CreateIndex
CREATE INDEX "sjr_job_started_idx" ON "ScheduledJobRun"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "sjr_stat_started_idx" ON "ScheduledJobRun"("status", "startedAt");

-- CreateIndex
CREATE INDEX "ecr_emp_stat_eff_idx" ON "EmployeeChangeRequest"("employeeId", "status", "requestedEffectiveDate");

-- CreateIndex
CREATE INDEX "ecr_req_by_idx" ON "EmployeeChangeRequest"("requestedByEmployeeId");

-- CreateIndex
CREATE INDEX "ecr_rev_by_idx" ON "EmployeeChangeRequest"("reviewedByEmployeeId");

-- CreateIndex
CREATE INDEX "ecr_rel_doc_idx" ON "EmployeeChangeRequest"("relatedDocumentId");

-- CreateIndex
CREATE UNIQUE INDEX "ecp_emp_key" ON "EmployeeCompensationProfile"("employeeId");

-- CreateIndex
CREATE INDEX "ecp_emp_eff_idx" ON "EmployeeCompensationProfile"("employeeId", "effectiveDate");

-- CreateIndex
CREATE INDEX "ech_emp_eff_created_idx" ON "EmployeeCompensationHistory"("employeeId", "effectiveDate", "createdAt");

-- CreateIndex
CREATE INDEX "ech_eff_idx" ON "EmployeeCompensationHistory"("effectiveDate");

-- CreateIndex
CREATE INDEX "ebe_emp_type_eff_idx" ON "EmployeeBenefitElection"("employeeId", "benefitType", "effectiveDate");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeContactInfo_employeeId_key" ON "EmployeeContactInfo"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeContactInfo_employeeId_idx" ON "EmployeeContactInfo"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeEmergencyContact_employeeId_priority_createdAt_idx" ON "EmployeeEmergencyContact"("employeeId", "priority", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PTORequest_graphCalendarEventId_key" ON "PTORequest"("graphCalendarEventId");

-- CreateIndex
CREATE INDEX "PTORequest_employeeId_status_idx" ON "PTORequest"("employeeId", "status");

-- CreateIndex
CREATE INDEX "PTORequestAction_requestId_createdAt_idx" ON "PTORequestAction"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "PTORequestAction_action_idx" ON "PTORequestAction"("action");

-- CreateIndex
CREATE UNIQUE INDEX "PTOLedger_sourceRequestId_key" ON "PTOLedger"("sourceRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "PTOLedger_idempotencyKey_key" ON "PTOLedger"("idempotencyKey");

-- CreateIndex
CREATE INDEX "PTOLedger_employeeId_bucket_effectiveDate_idx" ON "PTOLedger"("employeeId", "bucket", "effectiveDate");

-- CreateIndex
CREATE INDEX "PTOLedger_employeeId_bucket_effectiveDate_createdAt_idx" ON "PTOLedger"("employeeId", "bucket", "effectiveDate", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_idx" ON "AuditLog"("action");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_idx" ON "AuditLog"("entityType");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "EmployeeStatusHistory_employeeId_changedAt_idx" ON "EmployeeStatusHistory"("employeeId", "changedAt");

-- CreateIndex
CREATE INDEX "EmployeeStatusHistory_changedByEmployeeId_idx" ON "EmployeeStatusHistory"("changedByEmployeeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_category_createdAt_idx" ON "EmployeeDocument"("employeeId", "category", "createdAt");

-- CreateIndex
CREATE INDEX "EmployeeDocument_uploadedByEmployeeId_idx" ON "EmployeeDocument"("uploadedByEmployeeId");

-- CreateIndex
CREATE INDEX "AssignableDocument_createdByEmployeeId_idx" ON "AssignableDocument"("createdByEmployeeId");

-- CreateIndex
CREATE INDEX "AssignableDocumentVersion_assignableDocumentId_idx" ON "AssignableDocumentVersion"("assignableDocumentId");

-- CreateIndex
CREATE INDEX "AssignableDocumentVersion_employeeDocumentId_idx" ON "AssignableDocumentVersion"("employeeDocumentId");

-- CreateIndex
CREATE INDEX "AssignableDocumentVersion_createdByEmployeeId_idx" ON "AssignableDocumentVersion"("createdByEmployeeId");

-- CreateIndex
CREATE INDEX "eda_emp_stat_idx" ON "EmployeeDocumentAssignment"("employeeId", "status");

-- CreateIndex
CREATE INDEX "eda_doc_idx" ON "EmployeeDocumentAssignment"("assignableDocumentId");

-- CreateIndex
CREATE INDEX "eda_doc_ver_idx" ON "EmployeeDocumentAssignment"("assignableDocumentVersionId");

-- CreateIndex
CREATE INDEX "eda_src_type_idx" ON "EmployeeDocumentAssignment"("assignmentSourceType");

-- CreateIndex
CREATE INDEX "eda_src_req_idx" ON "EmployeeDocumentAssignment"("sourceEmployeeOnboardingTaskRequirementId");

-- CreateIndex
CREATE INDEX "eda_due_idx" ON "EmployeeDocumentAssignment"("dueDate");

-- CreateIndex
CREATE INDEX "eda_viewed_idx" ON "EmployeeDocumentAssignment"("viewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "eda_emp_doc_ver_key" ON "EmployeeDocumentAssignment"("employeeId", "assignableDocumentVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAssignmentEmailOutbox_employeeDocumentAssignmentId_key" ON "DocumentAssignmentEmailOutbox"("employeeDocumentAssignmentId");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAssignmentEmailOutbox_hrNotificationOutboxId_key" ON "DocumentAssignmentEmailOutbox"("hrNotificationOutboxId");

-- CreateIndex
CREATE INDEX "DocumentAssignmentEmailOutbox_status_idx" ON "DocumentAssignmentEmailOutbox"("status");

-- CreateIndex
CREATE INDEX "DocumentAssignmentEmailOutbox_createdAt_idx" ON "DocumentAssignmentEmailOutbox"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAssignmentReminderEmailOutbox_hrNotificationOutboxI_key" ON "DocumentAssignmentReminderEmailOutbox"("hrNotificationOutboxId");

-- CreateIndex
CREATE INDEX "idx_doc_assign_reminder_status" ON "DocumentAssignmentReminderEmailOutbox"("status");

-- CreateIndex
CREATE INDEX "idx_doc_assign_reminder_created" ON "DocumentAssignmentReminderEmailOutbox"("createdAt");

-- CreateIndex
CREATE INDEX "idx_doc_assign_reminder_day" ON "DocumentAssignmentReminderEmailOutbox"("reminderDay");

-- CreateIndex
CREATE UNIQUE INDEX "uq_doc_assign_reminder_day" ON "DocumentAssignmentReminderEmailOutbox"("employeeDocumentAssignmentId", "reminderType", "reminderDay");

-- CreateIndex
CREATE INDEX "OnboardingTemplateTask_templateId_sortOrder_idx" ON "OnboardingTemplateTask"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "ottdr_task_sort_idx" ON "OnboardingTemplateTaskDocumentRequirement"("templateTaskId", "sortOrder");

-- CreateIndex
CREATE INDEX "ottdr_doc_cat_idx" ON "OnboardingTemplateTaskDocumentRequirement"("documentCategory");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeOnboarding_employeeId_key" ON "EmployeeOnboarding"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeOnboarding_status_idx" ON "EmployeeOnboarding"("status");

-- CreateIndex
CREATE INDEX "EmployeeOnboarding_createdByEmployeeId_idx" ON "EmployeeOnboarding"("createdByEmployeeId");

-- CreateIndex
CREATE INDEX "EmployeeOnboardingTask_employeeOnboardingId_sortOrder_idx" ON "EmployeeOnboardingTask"("employeeOnboardingId", "sortOrder");

-- CreateIndex
CREATE INDEX "EmployeeOnboardingTask_assigneeType_status_idx" ON "EmployeeOnboardingTask"("assigneeType", "status");

-- CreateIndex
CREATE INDEX "EmployeeOnboardingTask_assignedEmployeeId_status_idx" ON "EmployeeOnboardingTask"("assignedEmployeeId", "status");

-- CreateIndex
CREATE INDEX "eotdr_task_idx" ON "EmployeeOnboardingTaskDocumentRequirement"("employeeOnboardingTaskId");

-- CreateIndex
CREATE INDEX "eotdr_doc_cat_idx" ON "EmployeeOnboardingTaskDocumentRequirement"("documentCategory");

-- CreateIndex
CREATE INDEX "ottar_task_sort_idx" ON "OnboardingTemplateTaskAcknowledgementRequirement"("templateTaskId", "sortOrder");

-- CreateIndex
CREATE INDEX "ottar_doc_idx" ON "OnboardingTemplateTaskAcknowledgementRequirement"("assignableDocumentId");

-- CreateIndex
CREATE INDEX "eotar_task_idx" ON "EmployeeOnboardingTaskAcknowledgementRequirement"("employeeOnboardingTaskId");

-- CreateIndex
CREATE INDEX "eotar_doc_idx" ON "EmployeeOnboardingTaskAcknowledgementRequirement"("assignableDocumentId");

-- CreateIndex
CREATE INDEX "eotar_doc_ver_idx" ON "EmployeeOnboardingTaskAcknowledgementRequirement"("assignedDocumentVersionId");

-- CreateIndex
CREATE INDEX "eotar_eda_idx" ON "EmployeeOnboardingTaskAcknowledgementRequirement"("employeeDocumentAssignmentId");

-- CreateIndex
CREATE INDEX "OffboardingTemplateTask_templateId_sortOrder_idx" ON "OffboardingTemplateTask"("templateId", "sortOrder");

-- CreateIndex
CREATE INDEX "EmployeeOffboarding_status_idx" ON "EmployeeOffboarding"("status");

-- CreateIndex
CREATE INDEX "EmployeeOffboarding_terminationDate_idx" ON "EmployeeOffboarding"("terminationDate");

-- CreateIndex
CREATE INDEX "EmployeeOffboardingTask_employeeOffboardingId_sortOrder_idx" ON "EmployeeOffboardingTask"("employeeOffboardingId", "sortOrder");

-- CreateIndex
CREATE INDEX "EmployeeOffboardingTask_assigneeType_status_idx" ON "EmployeeOffboardingTask"("assigneeType", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "RolePermission_roleId_idx" ON "RolePermission"("roleId");

-- CreateIndex
CREATE INDEX "RolePermission_permissionId_idx" ON "RolePermission"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_roleId_permissionId_key" ON "RolePermission"("roleId", "permissionId");

-- CreateIndex
CREATE INDEX "EmployeeRoleAssignment_employeeId_idx" ON "EmployeeRoleAssignment"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeRoleAssignment_roleId_idx" ON "EmployeeRoleAssignment"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "EmployeeRoleAssignment_employeeId_roleId_isActive_key" ON "EmployeeRoleAssignment"("employeeId", "roleId", "isActive");

-- AddForeignKey
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrNotificationOutbox" ADD CONSTRAINT "HrNotificationOutbox_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrNotificationOutbox" ADD CONSTRAINT "HrNotificationOutbox_recipientEmployeeId_fkey" FOREIGN KEY ("recipientEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HrNotificationOutbox" ADD CONSTRAINT "HrNotificationOutbox_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeChangeRequest" ADD CONSTRAINT "ecr_emp_fk" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeChangeRequest" ADD CONSTRAINT "ecr_req_by_fk" FOREIGN KEY ("requestedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeChangeRequest" ADD CONSTRAINT "ecr_rev_by_fk" FOREIGN KEY ("reviewedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeChangeRequest" ADD CONSTRAINT "ecr_rel_doc_fk" FOREIGN KEY ("relatedDocumentId") REFERENCES "EmployeeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensationProfile" ADD CONSTRAINT "ecp_emp_fk" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeCompensationHistory" ADD CONSTRAINT "ech_emp_fk" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeBenefitElection" ADD CONSTRAINT "ebe_emp_fk" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeContactInfo" ADD CONSTRAINT "EmployeeContactInfo_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeEmergencyContact" ADD CONSTRAINT "EmployeeEmergencyContact_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTORequest" ADD CONSTRAINT "PTORequest_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTORequestAction" ADD CONSTRAINT "PTORequestAction_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "PTORequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PTOLedger" ADD CONSTRAINT "PTOLedger_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeStatusHistory" ADD CONSTRAINT "EmployeeStatusHistory_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument" ADD CONSTRAINT "EmployeeDocument_uploadedByEmployeeId_fkey" FOREIGN KEY ("uploadedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignableDocument" ADD CONSTRAINT "AssignableDocument_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignableDocument" ADD CONSTRAINT "AssignableDocument_currentVersionId_fkey" FOREIGN KEY ("currentVersionId") REFERENCES "AssignableDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignableDocumentVersion" ADD CONSTRAINT "AssignableDocumentVersion_assignableDocumentId_fkey" FOREIGN KEY ("assignableDocumentId") REFERENCES "AssignableDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignableDocumentVersion" ADD CONSTRAINT "AssignableDocumentVersion_employeeDocumentId_fkey" FOREIGN KEY ("employeeDocumentId") REFERENCES "EmployeeDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssignableDocumentVersion" ADD CONSTRAINT "AssignableDocumentVersion_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocumentAssignment" ADD CONSTRAINT "eda_emp_fk" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocumentAssignment" ADD CONSTRAINT "eda_doc_fk" FOREIGN KEY ("assignableDocumentId") REFERENCES "AssignableDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocumentAssignment" ADD CONSTRAINT "eda_doc_ver_fk" FOREIGN KEY ("assignableDocumentVersionId") REFERENCES "AssignableDocumentVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocumentAssignment" ADD CONSTRAINT "eda_assigned_by_fk" FOREIGN KEY ("assignedByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocumentAssignment" ADD CONSTRAINT "eda_src_req_fk" FOREIGN KEY ("sourceEmployeeOnboardingTaskRequirementId") REFERENCES "EmployeeOnboardingTaskAcknowledgementRequirement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignmentEmailOutbox" ADD CONSTRAINT "DocumentAssignmentEmailOutbox_employeeDocumentAssignmentId_fkey" FOREIGN KEY ("employeeDocumentAssignmentId") REFERENCES "EmployeeDocumentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignmentEmailOutbox" ADD CONSTRAINT "DocumentAssignmentEmailOutbox_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignmentEmailOutbox" ADD CONSTRAINT "DocumentAssignmentEmailOutbox_hrNotificationOutboxId_fkey" FOREIGN KEY ("hrNotificationOutboxId") REFERENCES "HrNotificationOutbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignmentReminderEmailOutbox" ADD CONSTRAINT "fk_doc_assign_reminder_assignment" FOREIGN KEY ("employeeDocumentAssignmentId") REFERENCES "EmployeeDocumentAssignment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignmentReminderEmailOutbox" ADD CONSTRAINT "fk_doc_assign_reminder_employee" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentAssignmentReminderEmailOutbox" ADD CONSTRAINT "fk_doc_assign_reminder_hr_notification" FOREIGN KEY ("hrNotificationOutboxId") REFERENCES "HrNotificationOutbox"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTask" ADD CONSTRAINT "OnboardingTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTaskDocumentRequirement" ADD CONSTRAINT "OnboardingTemplateTaskDocumentRequirement_templateTaskId_fkey" FOREIGN KEY ("templateTaskId") REFERENCES "OnboardingTemplateTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboarding" ADD CONSTRAINT "EmployeeOnboarding_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboarding" ADD CONSTRAINT "EmployeeOnboarding_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTask" ADD CONSTRAINT "EmployeeOnboardingTask_employeeOnboardingId_fkey" FOREIGN KEY ("employeeOnboardingId") REFERENCES "EmployeeOnboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTask" ADD CONSTRAINT "EmployeeOnboardingTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTask" ADD CONSTRAINT "EmployeeOnboardingTask_sourceTemplateTaskId_fkey" FOREIGN KEY ("sourceTemplateTaskId") REFERENCES "OnboardingTemplateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTaskDocumentRequirement" ADD CONSTRAINT "eotdr_task_fk" FOREIGN KEY ("employeeOnboardingTaskId") REFERENCES "EmployeeOnboardingTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTaskDocumentRequirement" ADD CONSTRAINT "eotdr_link_doc_fk" FOREIGN KEY ("linkedEmployeeDocumentId") REFERENCES "EmployeeDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTaskDocumentRequirement" ADD CONSTRAINT "eotdr_link_by_fk" FOREIGN KEY ("linkedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTaskAcknowledgementRequirement" ADD CONSTRAINT "ottar_task_fk" FOREIGN KEY ("templateTaskId") REFERENCES "OnboardingTemplateTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OnboardingTemplateTaskAcknowledgementRequirement" ADD CONSTRAINT "ottar_doc_fk" FOREIGN KEY ("assignableDocumentId") REFERENCES "AssignableDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTaskAcknowledgementRequirement" ADD CONSTRAINT "eotar_task_fk" FOREIGN KEY ("employeeOnboardingTaskId") REFERENCES "EmployeeOnboardingTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTaskAcknowledgementRequirement" ADD CONSTRAINT "eotar_doc_fk" FOREIGN KEY ("assignableDocumentId") REFERENCES "AssignableDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTaskAcknowledgementRequirement" ADD CONSTRAINT "eotar_doc_ver_fk" FOREIGN KEY ("assignedDocumentVersionId") REFERENCES "AssignableDocumentVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOnboardingTaskAcknowledgementRequirement" ADD CONSTRAINT "eotar_eda_fk" FOREIGN KEY ("employeeDocumentAssignmentId") REFERENCES "EmployeeDocumentAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OffboardingTemplateTask" ADD CONSTRAINT "OffboardingTemplateTask_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OffboardingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOffboarding" ADD CONSTRAINT "EmployeeOffboarding_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOffboarding" ADD CONSTRAINT "EmployeeOffboarding_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OffboardingTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOffboarding" ADD CONSTRAINT "EmployeeOffboarding_createdByEmployeeId_fkey" FOREIGN KEY ("createdByEmployeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOffboardingTask" ADD CONSTRAINT "EmployeeOffboardingTask_employeeOffboardingId_fkey" FOREIGN KEY ("employeeOffboardingId") REFERENCES "EmployeeOffboarding"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOffboardingTask" ADD CONSTRAINT "EmployeeOffboardingTask_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOffboardingTask" ADD CONSTRAINT "EmployeeOffboardingTask_assignedEmployeeId_fkey" FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOffboardingTask" ADD CONSTRAINT "EmployeeOffboardingTask_completedByEmployeeId_fkey" FOREIGN KEY ("completedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeOffboardingTask" ADD CONSTRAINT "EmployeeOffboardingTask_sourceTemplateTaskId_fkey" FOREIGN KEY ("sourceTemplateTaskId") REFERENCES "OffboardingTemplateTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RolePermission" ADD CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRoleAssignment" ADD CONSTRAINT "EmployeeRoleAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeRoleAssignment" ADD CONSTRAINT "EmployeeRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

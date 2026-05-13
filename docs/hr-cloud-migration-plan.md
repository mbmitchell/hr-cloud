# HR Cloud Migration Plan

## Purpose

This document inventories the current MFN HR fork and outlines the safest path to prepare it for an `hr-cloud` deployment without breaking the existing application behavior.

Operational separation details and recommended target values are documented in [docs/hr-cloud-environment-separation.md](/Users/mmitchell/dev/hr-cloud/docs/hr-cloud-environment-separation.md).

This first pass is intentionally documentation-only:

- no Prisma schema changes
- no database table renames
- no removal of MFN-specific logic
- no multi-tenant SaaS changes

## Current Architecture Summary

The copied app is still the existing MFN HR platform with these major characteristics:

- Next.js 15 App Router application with React, TypeScript, and Tailwind CSS
- Prisma ORM against MySQL
- Auth.js / NextAuth authentication with Microsoft Entra ID
- strict server-side authorization and role/permission checks
- PTO workflows, approvals, accruals, rollover, and liability reporting
- employee directory, profile, onboarding, offboarding, and document acknowledgement modules
- audit logging and security event logging
- Microsoft Graph-backed email and calendar integration
- internal scheduled job framework protected by `INTERNAL_JOB_SECRET`
- document file storage outside the web app directory via `DOCUMENT_STORAGE_ROOT`

## Files Likely Requiring Cloud-Specific Changes

The following files are the highest-value migration touchpoints identified during inspection.

### App identity, branding, and internal naming

- `package.json`
  - package metadata should remain aligned to `hr-cloud-app`
- `README.md`
  - still describes the MFN deployment, paths, and process names
- `ARCHITECTURE.md`
  - still describes the MFN deployment and assumptions
- `AUTH_VERIFICATION.md`
  - still references current Entra verification assumptions
- `components/layout/app-shell.tsx`
- `components/layout/header.tsx`
- `components/layout/sidebar-client.tsx`
  - UI labels still say `MFN HR` and `Managed Financial Networks`
- `lib/notifications/email/templates/pto.ts`
- `lib/server/hr-notifications/templates/index.ts`
- `lib/server/hr-notifications/pto.ts`
- `lib/server/hr-notifications/document-acknowledgements.ts`
- `lib/server/email/send-document-assignment-email.ts`
- `lib/server/email/send-document-assignment-reminder-email.ts`
  - email subjects and body copy still reference `MFN HR Platform`
- `lib/server/internal-jobs/pto-liability.ts`
  - generated report naming still uses `MFN HR`

### Authentication and domain assumptions

- `auth.ts`
  - core Auth.js setup for Entra and temporary dev auth
- `lib/auth/microsoft-entra-sso.ts`
  - hardcoded `allowedMicrosoftEmailDomain = "mfncuso.com"`
- `lib/server/auth-diagnostics.ts`
  - auth diagnostics reflect current Entra assumptions
- `tests/auth-microsoft-entra-sso.test.ts`
- `tests/auth-diagnostics.test.ts`
  - tests currently lock in the MFN email-domain behavior

### Deployment and runtime assumptions

- `.github/workflows/deploy.yml`
  - should use hr-cloud-specific secrets, directory, and process name only
- `README.md`
  - deployment and cron examples must stay isolated from MFN infrastructure
- `apprunner.yaml`
  - cloud deployment template exists but still requires platform-specific value replacement before use
- `.env.example`
  - defaults now use hr-cloud placeholders and must stay separate from MFN infrastructure

### Database, seed data, and storage assumptions

- `.env.example`
  - sample database name now uses `hr_cloud`
  - document storage root now uses `/var/lib/hr-cloud-documents`
- `prisma/seed.ts`
  - seed employee emails still use `@mfncuso.com`
- `lib/server/documents/storage.ts`
  - development fallback path is `/tmp/mfn-hr-documents-dev`
- `prisma/schema.prisma`
  - schema should remain unchanged for now, but existing field/model naming needs review before any cloud-specific data divergence

## Environment Variables That Need Review

These variables should be explicitly reviewed before any cloud deployment is attempted.

### Core app and auth

- `DATABASE_URL`
- `NEXTAUTH_SECRET`
- `NEXTAUTH_URL`
- `APP_BASE_URL`
- `AUTH_MICROSOFT_ENTRA_ID_ID`
- `AUTH_MICROSOFT_ENTRA_ID_SECRET`
- `AUTH_MICROSOFT_ENTRA_ID_ISSUER`
- `AUTH_ENABLE_DEV_AUTH`
- `AUTH_DEV_PASSWORD`
- `AUTH_DEV_AUTH_EMAIL_ALLOWLIST`
- `AUTH_ENABLE_DEV_USER_SWITCHER`

### Email, calendar, and notifications

- `EMAIL_TRANSPORT`
- `EMAIL_FROM`
- `EMAIL_REPLY_TO`
- `GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET`
- `GRAPH_MAILBOX_USER_ID`
- `HR_NOTIFICATION_BATCH_SIZE`
- `HR_NOTIFICATION_MAX_ATTEMPTS`
- `HR_NOTIFICATION_RETRY_DELAY_MINUTES`

### Documents and internal jobs

- `DOCUMENT_STORAGE_ROOT`
- `DOCUMENT_ALLOWED_MIME_TYPES`
- `DOCUMENT_MAX_UPLOAD_BYTES`
- `DOCUMENT_ACKNOWLEDGEMENT_REMINDERS_ENABLED`
- `DOCUMENT_ACKNOWLEDGEMENT_REMINDER_STALE_DAYS`
- `INTERNAL_JOB_SECRET`

### Workflow automation and escalation settings

- `JOB_CHANGE_AUTO_APPLY_ENABLED`
- `JOB_CHANGE_PENDING_ESCALATION_DAYS`
- `PTO_PENDING_ESCALATION_HOURS`

### Deployment-template-specific variable

- `DEV_OVERRIDE`
  - currently present in `apprunner.yaml`; confirm whether it is still required

## Database and Prisma Migration Considerations

- Do not rename tables or models during the first cloud-prep pass.
- Do not fork the schema unless there is a clearly documented cloud-only requirement.
- Decide whether `hr-cloud` will use:
  - a clean new database with copied schema and no production data
  - a sanitized copy of data from an existing environment
  - a long-lived parallel database with its own migration history
- Keep existing Prisma migration history intact so the fork remains reproducible.
- Review unique constraints and employee identity assumptions before any data import, especially:
  - `Employee.email`
  - `Employee.entraTid + Employee.entraOid`
- Treat `prisma/seed.ts` as MFN-specific sample/bootstrap data and not cloud-ready seed data.
- Any later cloud-specific schema changes should be introduced as additive migrations only.

## Authentication and SSO Considerations

- The current sign-in flow is intentionally single-company and internal-only.
- Login requires a pre-existing `Employee` row; that behavior should remain unless explicitly redesigned.
- Microsoft sign-in currently hard-fails for any account outside `@mfncuso.com`.
- Tenant validation is derived from `AUTH_MICROSOFT_ENTRA_ID_ISSUER`, so the cloud fork needs its own Entra registration and tenant decision.
- Callback URLs in local, staging, and production environments must be registered explicitly for the cloud fork.
- Temporary dev auth remains present and must stay disabled outside development.
- If the cloud version eventually needs a different company domain model, that should be handled as a dedicated auth change with test updates, not as a documentation side effect.

## Email and Notification Considerations

- Outbound email currently assumes Microsoft Graph app-only delivery in production.
- Default sample addresses are still MFN-specific:
  - `EMAIL_FROM`
  - `EMAIL_REPLY_TO`
  - `GRAPH_MAILBOX_USER_ID`
- User-facing notification copy still references `MFN HR`, which could confuse recipients if the fork is used as-is.
- PTO, acknowledgement, and HR notification templates should be migrated together so the app name stays consistent across channels.
- Calendar delivery also depends on Microsoft Graph mailbox/calendar permissions and should be validated separately from email send permissions.

## File and Document Storage Considerations

- Employee documents are already stored outside the app directory, which is the correct pattern to preserve.
- The cloud fork still needs its own storage root, retention policy, backup plan, and access-control review.
- `DOCUMENT_STORAGE_ROOT` must not point at an existing MFN production storage location.
- The development fallback path in `lib/server/documents/storage.ts` still uses an MFN-style folder name; that is low risk for local development but should eventually be renamed for clarity.
- Future object storage migration, if desired, should be handled behind the current metadata/storage abstraction rather than by changing feature behavior first.

## Deployment Considerations

- GitHub Actions, App Runner, cron, logs, and storage must all remain pointed at hr-cloud-specific infrastructure.
- `apprunner.yaml` suggests an alternate cloud deployment path, but it still requires a full configuration review before adoption.
- Port `3000` is currently assumed by both local scripts and runtime templates.
- The cloud fork should have its own:
  - server path or container service
  - PM2 process name or service name
  - environment secret set
  - TLS/domain configuration
  - job scheduling configuration
  - log destinations

## Risks From Copying the Existing App

- Branding drift: users or admins may see `MFN HR` strings in the UI, emails, exports, and operational logs.
- Deployment collision: inherited deploy scripts could accidentally target the original environment if reused without review.
- Auth mismatch: current domain and tenant restrictions can block cloud sign-in entirely or cause confusing failures.
- Data contamination: seed data and environment defaults can point new environments back toward MFN-style addresses and names.
- Storage collision: reused document paths or mailbox settings could mix cloud and existing environment artifacts.
- Test expectation drift: current tests intentionally enforce MFN-specific auth assumptions.
- Operational confusion: internal jobs, reminder runs, and PM2/service names still reflect the source deployment.

## Recommended Phased Plan

### Phase 0: Documentation and inventory

- Complete this inventory pass.
- Freeze any deployment of the fork until environment ownership is clearly separated.

### Phase 1: Safe configuration separation

- Create distinct cloud environment files, secrets, deployment paths, and process names.
- Update README, deployment docs, and runbooks to prevent accidental deployment over the existing MFN app.
- Decide whether App Runner, PM2 on a separate host, or another runtime is the target deployment path.

### Phase 2: Branding and operational rename pass

- Update package metadata, UI labels, email subjects/body copy, report labels, and non-security-sensitive folder names.
- Update deployment workflow names, cron examples, log file names, and storage defaults.
- Keep behavior identical while removing operator confusion.

### Phase 3: Authentication and identity decision

- Decide whether `hr-cloud` remains single-tenant internal for one company or evolves into a broader cloud product.
- If domain or tenant behavior changes, update:
  - `lib/auth/microsoft-entra-sso.ts`
  - auth tests
  - auth diagnostics
  - environment documentation
- Re-verify that pre-provisioned employee login requirements and server-side authorization still hold.

### Phase 4: Data and storage separation

- Stand up the dedicated cloud database.
- Decide how to seed or import initial employee and policy data.
- Validate document storage, email mailbox, and calendar isolation from the existing MFN environment.

### Phase 5: Optional cloud-specific product work

- Only after the fork is operationally separated should broader product changes be considered.
- Examples:
  - broader organization support
  - tenant-aware configuration
  - cloud-native job orchestration
  - object storage

## Immediate Recommendation

Before any behavior changes, separate the cloud fork operationally:

1. give it its own deployment target
2. give it its own secrets and database
3. give it its own document storage location
4. decide whether its Entra tenant/domain rules will stay MFN-specific or change later

That keeps the next implementation pass small, auditable, and much less likely to impact the existing MFN HR production environment.

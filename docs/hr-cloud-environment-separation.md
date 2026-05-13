# HR Cloud Environment Separation

## Purpose

This document defines the minimum operational separation required so the `hr-cloud` fork cannot accidentally deploy over, connect to, or reuse sensitive infrastructure from the existing MFN HR production application.

This is a configuration and deployment separation guide only.

- no feature changes
- no Prisma schema changes
- no business-logic changes
- no tenant-model changes

## Current Risk Summary

The fork still contains inherited MFN operational defaults in documentation and example configuration, including:

- GitHub deploy workflow originally targeted `~/mfn-hr-app`
- PM2 process name originally used `mfn-hr`
- sample development storage fallback path still uses an MFN-style name in code
- existing auth/domain logic tied to `@mfncuso.com`

Those values must not be reused for `hr-cloud` production infrastructure.

## Recommended Separate Values For HR Cloud

These are recommended target values for the fork. They are intentionally examples and placeholders, not committed secrets.

| Area | Recommended hr-cloud value | Notes |
| --- | --- | --- |
| App name | `hr-cloud-app` | Use for package metadata, process labels, and operator-facing documentation. |
| PM2 process name | `hr-cloud` | Must not reuse `mfn-hr`. |
| Deployment directory | `/home/hr-cloud/hr-cloud-app` | Separate Unix user and separate app path recommended. |
| GitHub repo | `hr-cloud` fork repository only | Deploy automation should target this fork, not the original MFN repo. |
| Database name | `hr_cloud` | Use a dedicated MySQL database and dedicated DB credentials. |
| Production app URL | `https://hr-cloud.example.com` | Replace with the real cloud hostname once assigned. |
| NextAuth secret handling | unique `NEXTAUTH_SECRET` for hr-cloud only | Generate and store in the cloud secret store; never reuse the MFN secret. |
| App base URL | `https://hr-cloud.example.com` | Keep `APP_BASE_URL` and `NEXTAUTH_URL` aligned. |
| Microsoft Entra app registration | dedicated hr-cloud app registration | Separate client ID, secret, redirect URIs, and tenant decision. |
| Microsoft Graph sender | `notifications@hr-cloud.example.com` | Use a separate mailbox identity and separate app permissions. |
| Internal job key | unique `INTERNAL_JOB_SECRET` for hr-cloud only | Never reuse the existing system's job key. |
| Document storage root | `/var/lib/hr-cloud-documents` | Must be separate from MFN storage roots and backups. |
| Backup location | `/var/backups/hr-cloud` or managed backup target dedicated to hr-cloud | Backups must be isolated from MFN retention and restore workflows. |
| App logs | `/var/log/hr-cloud` | Separate app, scheduler, and deployment logs. |
| Reminder cron log | `/var/log/hr-cloud/acknowledgement-reminders.log` | Do not reuse MFN log files. |

## Operational Separation Checklist

### 1. Repository and deployment target

- Deploy only from the `hr-cloud` fork repository.
- Use separate GitHub secrets for the fork.
- Use a separate deployment host, service, or container target.
- If reusing a host, use a separate Unix user and separate app directory.
- For GitHub Actions SSH deploys, prefer secret names such as:
  - `HR_CLOUD_SERVER_HOST`
  - `HR_CLOUD_SERVER_USER`
  - `HR_CLOUD_SERVER_SSH_KEY`
  - `HR_CLOUD_SERVER_PORT`

### 2. Process and runtime identity

- Use a separate PM2 process name such as `hr-cloud`.
- Use separate service labels in monitoring and alerting.
- Use distinct log file names and log directories.
- Do not reuse `mfn-hr` process commands, restart commands, or dashboard labels.

### 3. Database separation

- Create a dedicated MySQL database such as `hr_cloud`.
- Create a dedicated database user for the fork.
- Use a dedicated `DATABASE_URL`.
- Do not point `hr-cloud` at the existing MFN production database, even temporarily.
- Preserve the current Prisma schema and migration history, but run them only against the dedicated cloud database.

### 4. Auth and cookie separation

- Use a unique `NEXTAUTH_SECRET`.
- Use a distinct `NEXTAUTH_URL`.
- Keep `APP_BASE_URL` aligned to the cloud hostname.
- Register a separate Microsoft Entra application for the fork.
- Use a separate redirect URI set for local, staging, and production cloud environments.
- Keep `AUTH_ENABLE_DEV_AUTH="false"` in production.
- Keep `AUTH_ENABLE_DEV_USER_SWITCHER="false"` in production.

Important current limitation:

- The current code still enforces the `@mfncuso.com` email-domain rule in `lib/auth/microsoft-entra-sso.ts`.
- That behavior is unchanged in this pass and must be considered when planning cloud identity separation.

### 5. Email and Microsoft Graph separation

- Use separate `EMAIL_FROM` and `EMAIL_REPLY_TO` values for hr-cloud.
- Use a separate `GRAPH_MAILBOX_USER_ID`.
- Use a separate Graph app registration or at minimum separate credentials and mailbox authorization.
- Do not reuse the MFN production mailbox or sender identity.

### 6. Internal job separation

- Generate a unique `INTERNAL_JOB_SECRET`.
- Store it in the cloud environment secret manager only.
- Keep internal job callers local/loopback plus secret-protected, as the current code expects.
- Separate scheduled job automation, cron entries, and logs from MFN.

### 7. Document storage separation

- Set `DOCUMENT_STORAGE_ROOT` to a dedicated path such as `/var/lib/hr-cloud-documents`.
- Do not share storage roots, object-store prefixes, or mounted volumes with MFN.
- Keep document backups separate from MFN document backups.
- Validate restore procedures independently.

### 8. Backups and logs

- Use separate database backup destinations.
- Use separate document backup destinations.
- Use separate log directories for:
  - app runtime
  - deploy logs
  - reminder jobs
  - PM2 logs
- Make sure retention and restore procedures reference `hr-cloud` explicitly.

## Deployment Automation Notes

### GitHub Actions workflow

The checked-in workflow now uses hr-cloud-specific placeholders:

- workflow name: `Deploy HR Cloud App`
- SSH secrets:
  - `HR_CLOUD_SERVER_HOST`
  - `HR_CLOUD_SERVER_USER`
  - `HR_CLOUD_SERVER_SSH_KEY`
  - `HR_CLOUD_SERVER_PORT`
- remote app directory: `/home/hr-cloud/hr-cloud-app`
- PM2 process name: `hr-cloud`

Before enabling that workflow:

1. confirm the remote checkout is the `hr-cloud` fork, not the original MFN HR repo
2. confirm the remote `.env` points at the dedicated `hr_cloud` database
3. confirm the remote storage root is `/var/lib/hr-cloud-documents` or equivalent
4. confirm the remote mailbox and Graph credentials are hr-cloud-specific
5. confirm the remote `INTERNAL_JOB_SECRET` is unique to hr-cloud

### App Runner template

`apprunner.yaml` is a placeholder deployment template only. It now uses hr-cloud-specific example values for:

- `NEXTAUTH_URL`
- `APP_BASE_URL`
- `DATABASE_URL`
- Microsoft Entra client settings
- Graph mail settings
- `DOCUMENT_STORAGE_ROOT`
- `INTERNAL_JOB_SECRET`

Before using App Runner, replace every `SET_HR_CLOUD_*` value with the real hr-cloud configuration in the deployment platform, not in git.

### Package metadata

The package metadata now uses `hr-cloud-app` so local build output and operator-visible tooling do not continue advertising the old app name.

## Example Recommended Environment Values

These are placeholder examples only.

```dotenv
DATABASE_URL="mysql://HR_CLOUD_DB_USER:HR_CLOUD_DB_PASSWORD@HR_CLOUD_DB_HOST:3306/hr_cloud"
NEXTAUTH_SECRET="GENERATE_A_UNIQUE_HR_CLOUD_SECRET"
NEXTAUTH_URL="https://hr-cloud.example.com"
APP_BASE_URL="https://hr-cloud.example.com"

AUTH_MICROSOFT_ENTRA_ID_ID="HR_CLOUD_ENTRA_APP_CLIENT_ID_GUID"
AUTH_MICROSOFT_ENTRA_ID_SECRET="HR_CLOUD_ENTRA_APP_CLIENT_SECRET"
AUTH_MICROSOFT_ENTRA_ID_ISSUER="https://login.microsoftonline.com/HR_CLOUD_TENANT_ID/v2.0"

AUTH_ENABLE_DEV_AUTH="false"
AUTH_ENABLE_DEV_USER_SWITCHER="false"

EMAIL_TRANSPORT="graph"
EMAIL_FROM="notifications@hr-cloud.example.com"
EMAIL_REPLY_TO="hr@hr-cloud.example.com"
GRAPH_TENANT_ID="HR_CLOUD_GRAPH_TENANT_ID"
GRAPH_CLIENT_ID="HR_CLOUD_GRAPH_CLIENT_ID"
GRAPH_CLIENT_SECRET="HR_CLOUD_GRAPH_CLIENT_SECRET"
GRAPH_MAILBOX_USER_ID="notifications@hr-cloud.example.com"

DOCUMENT_STORAGE_ROOT="/var/lib/hr-cloud-documents"
INTERNAL_JOB_SECRET="GENERATE_A_UNIQUE_HR_CLOUD_INTERNAL_JOB_SECRET"
```

## Lockfile / Next.js Workspace Root Warning

During `npm run build`, Next.js reported that it detected multiple lockfiles and selected `/Users/mmitchell/package-lock.json` as the workspace root instead of this project directory.

Observed lockfiles:

- `/Users/mmitchell/package-lock.json`
- `/Users/mmitchell/dev/hr-cloud/package-lock.json`

Recommended fix:

1. confirm whether `/Users/mmitchell/package-lock.json` belongs to an unrelated parent-level project
2. if it is unrelated, remove or relocate that parent lockfile outside this app's directory tree
3. if it must remain, set `outputFileTracingRoot` in `next.config.ts` so Next.js uses the intended workspace root explicitly

Do not delete either lockfile blindly. The parent lockfile should be reviewed before any cleanup.

Recommended future config-only fix:

- set `outputFileTracingRoot` in `next.config.ts` to the hr-cloud project root once you are ready to make a small deployment-config update
- validate that the change does not affect local development or deployment packaging before relying on it in production

## Files Reviewed For This Separation Pass

- `package.json`
- `README.md`
- `docs/hr-cloud-migration-plan.md`
- `.env.example`
- `.github/workflows/deploy.yml`
- `apprunner.yaml`
- `next.config.ts`
- `auth.ts`
- `lib/auth/microsoft-entra-sso.ts`
- `lib/notifications/email/send-email.ts`
- `lib/server/internal-jobs/auth.ts`
- `lib/server/documents/storage.ts`

## Recommended Next Phase

The next safe phase is a configuration-only operational rename pass:

1. update deploy automation and runbooks to use `hr-cloud` process names, paths, and secrets
2. update package metadata and non-runtime operator-facing names
3. explicitly choose the cloud production hostname, database, mailbox, and Entra app registration
4. keep Prisma schema and business logic unchanged while those separations are put in place

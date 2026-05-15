# Admin Identity Diagnostics UI

## Purpose

This phase surfaces read-only linked identity state inside existing admin
employee tooling so operators can review linkage quality before any tenant
enforcement work begins.

## UI Location

The diagnostics UI is rendered inside the existing admin employee detail tab:

- [app/employees/[id]/EmployeeAdminTab.tsx](/Users/mmitchell/dev/hr-cloud/app/employees/[id]/EmployeeAdminTab.tsx:1)

Panel component:

- [app/employees/[id]/EmployeeIdentityDiagnosticsPanel.tsx](/Users/mmitchell/dev/hr-cloud/app/employees/[id]/EmployeeIdentityDiagnosticsPanel.tsx:1)

Data source:

- [app/api/admin/auth/identity-linkage/[employeeId]/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/identity-linkage/[employeeId]/route.ts:1)

## What The Panel Shows

- employee email
- normalized email
- linked or unlinked status
- linked `User` email and active status if present
- provider names only
- organization membership count
- mismatch or conflict flags
- duplicate / relationship signal counts

The UI intentionally does not display:

- provider tokens
- provider secrets
- full provider payloads

## Operator Guidance

The panel includes short guidance for:

- `EMPLOYEE_NOT_LINKED`
- `EMPLOYEE_USER_EMAIL_MISMATCH`
- `USER_WITHOUT_IDENTITY`
- duplicate email risk flags

The goal is to help admins interpret the state without adding mutation actions
yet.

Detailed operator remediation guidance lives in:

- [docs/operator-identity-remediation-playbook.md](/Users/mmitchell/dev/hr-cloud/docs/operator-identity-remediation-playbook.md:1)

## What Did Not Change

- login behavior
- session shape
- permission behavior
- tenant enforcement
- PTO, documents, reports, onboarding, offboarding, job, or permission logic

## Recommended Next Phase

The next low-risk phase should add operator support around the diagnostics:

1. add optional preview links into the existing identity coverage/backfill admin route
2. keep the UI read-only until the remediation workflow is well understood
3. refine operator workflow support around the documented playbook

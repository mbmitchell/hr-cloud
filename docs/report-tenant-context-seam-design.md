# Report Tenant Context Seam Design

## Purpose

This phase defines how `TenantContext` should enter report pages, report API
routes, CSV exports, and PDF exports before any real tenant-scoped report
filtering is introduced.

It is documentation-only.

It does not change live report behavior.

It does not change exports.

It does not enforce tenant isolation.

## Current Report Inventory

### Employee-Centered Reports

1. employee master
   - page:
     - `app/reports/employee-master/page.tsx`
   - CSV export:
     - `app/api/reports/employee-master/export/route.ts`
   - PDF export:
     - `app/api/reports/employee-master/export-pdf/route.ts`
   - service seam:
     - `lib/server/reports/employee-master.ts`

2. PTO ledger
   - page:
     - `app/reports/pto-ledger/page.tsx`
   - CSV export:
     - `app/api/reports/pto-ledger/export/route.ts`
   - PDF export:
     - `app/api/reports/pto-ledger/export-pdf/route.ts`
   - service seam:
     - `lib/server/reports/pto-ledger.ts`

3. PTO liability
   - page:
     - `app/reports/pto-liability/page.tsx`
   - CSV export:
     - `app/api/reports/pto-liability/export/route.ts`
   - PDF export:
     - `app/api/reports/pto-liability/export-pdf/route.ts`
   - service seam:
     - `lib/server/reports/pto-liability.ts`

4. job changes
   - page:
     - `app/reports/job-changes/page.tsx`
   - CSV export:
     - `app/api/reports/job-changes/export/route.ts`
   - PDF export:
     - `app/api/reports/job-changes/export-pdf/route.ts`
   - service seam:
     - `lib/server/reports/job-changes.ts`

5. reporting structure
   - page:
     - `app/reports/reporting-structure/page.tsx`
   - CSV export:
     - `app/api/reports/reporting-structure/export/route.ts`
   - PDF export:
     - `app/api/reports/reporting-structure/export-pdf/route.ts`
   - service seam:
     - `lib/server/reports/reporting-structure.ts`

6. user access
   - page:
     - `app/reports/user-access/page.tsx`
   - CSV export:
     - `app/api/reports/user-access/export/route.ts`
   - PDF export:
     - `app/api/reports/user-access/export-pdf/route.ts`
   - service seam:
     - `lib/server/reports/user-access.ts`

7. document acknowledgements
   - page:
     - `app/reports/document-acknowledgements/page.tsx`
   - CSV export:
     - `app/api/reports/document-acknowledgements/export/route.ts`
   - PDF export:
     - `app/api/reports/document-acknowledgements/export-pdf/route.ts`
   - service seam:
     - `lib/server/reports/document-acknowledgements.ts`

### Higher-Sensitivity Reports

8. audit log
   - page:
     - `app/reports/audit-log/page.tsx`
   - CSV export:
     - `app/api/reports/audit-log/export/route.ts`
   - PDF export:
     - `app/api/reports/audit-log/export-pdf/route.ts`
   - service seam:
     - `lib/server/reports/audit-log.ts`

### Export-Only Report Paths

9. benefit withholding
   - CSV export:
     - `app/api/reports/benefit-withholding-export/route.ts`
   - current seam:
     - route-local export logic

10. liability export
   - CSV export bundle:
     - `app/api/reports/liability-export/route.ts`
   - current seam:
     - route-local export logic

### Report Summary Surface

11. reports summary
   - dashboard summary route:
     - `app/api/reports/summary/route.ts`
   - reports landing UI:
     - `app/reports/page.tsx`
     - `app/reports/ReportsClient.tsx`

## Current Query Seam Pattern

The dominant report pattern today is:

1. report page parses search params
2. page authorizes with `requireRole(...)`
3. page calls a report service in `lib/server/reports/*.ts`
4. export route separately authorizes with `requireRole(...)`
5. export route separately parses the same filters
6. export route separately calls the same report service

This means most report seams already exist in the right place:

- page seam
- export route seam
- report service seam

What is missing is an explicit `TenantContext` input path through those seams.

## Recommended Tenant Context Entry Points

### 1. Page Load

Recommended later pattern:

- page route keeps existing authorization logic
- after authorization succeeds, page resolves `TenantContext`
- page passes `TenantContext` into a report service or wrapper

This should happen only after the report has completed a shadow-compare phase.

### 2. API Route Edge

Recommended later pattern:

- admin/internal report diagnostics routes should resolve `TenantContext` at
  the route edge immediately after authorization
- diagnostics routes may return `tenantContext` as labeled metadata
- no live query filtering should happen until parity checks are complete

This is already the pattern used in the auth diagnostics routes and should be
reused for report diagnostics.

### 3. Export Route Edge

Recommended later pattern:

- CSV export routes keep existing authorization checks
- after authorization succeeds, export routes resolve `TenantContext`
- export routes pass both parsed filters and `TenantContext` into the report
  export service seam
- early phases should use shadow/compare only, not enforced filtering

CSV and PDF exports should adopt the same seam shape to avoid drift.

### 4. Report Service Layer

Recommended later service signature pattern:

- current:
  - `getReport(filters)`
  - `getReportExportRows(filters)`
- future seam:
  - `getReport(filters, options?)`
  - `getReportExportRows(filters, options?)`
  - where `options` may later include:
    - `tenantContext`
    - `mode: "live" | "shadow_compare"`
    - `includeDiagnostics`

Important:

- do not retrofit all reports at once
- use one report at a time
- keep default service behavior identical until a report is explicitly moved to
  a tenant-aware path

## Risk Classification

### Low Risk

1. employee master
   - already has shadow compare and shadow results UI
   - employee-centered
   - simple current-state roster data
   - safest first live seam candidate later

2. reporting structure
   - employee-centered
   - mostly manager/employee relationships
   - similar shape to employee master, but hierarchy integrity adds some risk

3. user access
   - employee-centered with role visibility
   - medium sensitivity, but structurally similar to employee roster data

### Medium Risk

4. job changes
   - includes historical workflow records
   - joins across employee state, submitter/approver flows, and change records

5. document acknowledgements
   - touches employees, assignable documents, versions, and acknowledgement
     state
   - may expose cross-organization template usage if scoped too early

6. PTO ledger
   - employee-centered but finance-sensitive
   - filter mistakes could change balances, summaries, or export counts

7. benefit withholding
   - export-only
   - payroll-sensitive
   - lacks a reusable service seam today, so it needs seam cleanup before any
     future scoping work

### High Risk

8. PTO liability
   - finance-sensitive
   - point-in-time liability math
   - likely used by scheduled or month-end operations

9. liability export
   - export-only bundle
   - likely aggregates liability-related outputs
   - not a good early scoping candidate

### Do Not Scope Yet

10. audit log
   - platform-sensitive
   - later tenant scoping must preserve platform-wide operator investigation,
     security review, and support use cases
   - should remain globally reviewable for platform admins until a dedicated
     platform-vs-tenant audit model is designed

11. reports summary
   - currently a landing summary surface, not a business record report seam
   - should follow later after underlying report seams are settled

## Shadow Compare Requirements Before Enforcement

Every report should complete these steps before any live tenant filter is
introduced:

1. add an admin-only shadow compare route
2. compare current result count vs tenant-scoped result count
3. count report rows missing `organizationId`
4. capture excluded rows when safe to inspect
5. warn when `tenantContext.organizationId` is null
6. surface results in a read-only diagnostics UI when practical
7. validate parity on default-org rehearsal data
8. confirm exports use the same seam expectations as the page

No report should move straight from global behavior to live tenant filtering.

## Reports That Should Not Be Scoped Yet

Explicit do-not-scope-yet set:

- audit log
- liability export
- PTO liability
- reports summary

Reason:

- these surfaces are either platform-sensitive, financially sensitive,
  aggregate-heavy, or still lacking a clean reusable seam for low-risk
  experimentation

## Recommended First Real Report Seam

Recommended first report seam for eventual real tenant filtering:

- employee master

Why:

- it already has both shadow compare and shadow results UI
- it is employee-centered and easier to validate than finance-oriented reports
- it has a clean existing service seam in
  `lib/server/reports/employee-master.ts`
- it has both page and export entry points that can later accept
  `TenantContext` in a controlled way

Recommended second seam after that:

- reporting structure

## Recommended Future Implementation Order

1. employee master
2. reporting structure
3. user access
4. job changes
5. document acknowledgements
6. PTO ledger
7. benefit withholding
8. PTO liability
9. liability export
10. audit log

## Guardrails

- do not change live report or export filters during seam-design phases
- do not enforce tenant isolation from page routes first
- do not scope exports differently from the page that generated them
- do not scope finance-sensitive reports before employee-centered reports prove
  the pattern
- do not tenant-scope audit logs until platform audit access is redesigned
- do not combine report scoping with auth/session changes

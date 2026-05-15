# Read-Only Repository Wrapper Pilot

## Purpose

This phase introduces a very small read-only wrapper that accepts
`TenantContext` without changing query behavior, returned data, or filters.

The goal is to prove a service or repository calling convention before any
tenant-aware query shaping begins.

## Pilot Scope

Chosen pilot query:

- identity linkage coverage preview used by
  [app/api/admin/auth/identity-linkage/route.ts](/Users/mmitchell/dev/hr-cloud/app/api/admin/auth/identity-linkage/route.ts:1)

New wrapper:

- [lib/server/auth/identity-linkage-readonly-repository.ts](/Users/mmitchell/dev/hr-cloud/lib/server/auth/identity-linkage-readonly-repository.ts:1)

## What Changed

The route now calls:

- `getIdentityLinkageCoverageSummaryForTenantContext(tenantContext)`

instead of calling the underlying diagnostics query directly.

The wrapper accepts `TenantContext` and records only lightweight diagnostics
metadata in local scope. It does not apply any organization filter, employee
filter, permission filter, or query rewrite.

## Expected Parity

Expected behavior remains identical:

- same Prisma query behavior
- same query filters
- same returned coverage payload
- same authorization requirements
- same status codes

The route still returns the already-existing `tenantContext` diagnostics field
from the earlier route-edge adoption phase. This pilot does not add any new
response fields.

## Why This Is A Safe Pilot

- the query is diagnostics-only
- the route is admin-only
- the wrapper delegates directly to the existing query
- no business-module behavior depends on this result for mutation or approval logic

## Testing Notes

No dedicated automated test was added in this phase.

Parity expectation is documented instead:

- the wrapper currently delegates directly to the existing
  `getIdentityLinkageCoverageSummary()` implementation
- any response difference from this phase would be unintended

## Recommended Next Phase

The next safest step is another read-only pilot at a slightly lower layer:

1. choose one low-risk read-only employee-directory or diagnostics query
2. add a similar `TenantContext`-accepting wrapper
3. keep returned data unchanged again
4. only after two or more successful pilots, consider a report/export read path

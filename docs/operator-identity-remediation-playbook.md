# Operator Identity Remediation Playbook

## Purpose

This playbook explains how admins/operators should review and resolve linked
identity diagnostics before tenant enforcement or deeper SaaS identity behavior
is introduced.

This is intentionally documentation-first.

It does not change:

- login behavior
- session behavior
- permission behavior
- tenant enforcement

## General Principles

Before acting on any flag:

1. confirm the employee record is the intended HR source of truth
2. review the read-only identity diagnostics panel and the coverage/backfill preview output together
3. prefer fixing duplicate or conflicting records before creating new automated links
4. avoid forcing changes when the cause is not clear
5. do not introduce manual provider identity guesses

## `EMPLOYEE_NOT_LINKED`

What it means:

- the employee record does not currently have a linked `userId`

Risk level:

- medium

Likely cause:

- the employee has not signed in since linkage scaffolding was added
- historical records existed before `User` backfill ran
- a prior linkage attempt was skipped because of ambiguity or conflict

Operator review steps:

1. confirm the employee email is correct and normalized as expected
2. check whether a `User` already exists with the same normalized email
3. review backfill preview results for the employee
4. check whether duplicate employee or user email flags are also present

Safe remediation path:

1. if preview shows a safe create-or-link action, use the controlled preview/apply backfill path
2. if the employee is expected to sign in soon, allow normal best-effort auth linkage to create the relationship
3. recheck diagnostics after the next successful sign-in or controlled backfill run

When not to auto-fix:

- when the employee email is suspected to be stale or incorrect
- when duplicate employee or user email flags are present
- when a linked user conflict is already reported elsewhere

## `EMPLOYEE_EMAIL_DUPLICATE`

What it means:

- more than one employee record shares the same normalized email

Risk level:

- high

Likely cause:

- duplicate employee creation
- legacy imports or copied test data
- one record should have been deactivated or merged but was not

Operator review steps:

1. identify every employee record sharing the normalized email
2. confirm which record is active and authoritative
3. compare names, status, hire date, manager, and business context
4. check whether one record is obsolete, test data, or an accidental duplicate

Safe remediation path:

1. resolve the duplicate employee records in the HR dataset first
2. keep only the authoritative email relationship for future linkage
3. rerun diagnostics and preview backfill after the employee records are cleaned up

When not to auto-fix:

- always avoid auto-fixing this through user linkage alone
- do not backfill identity links until the employee-side duplicate is resolved

## `USER_EMAIL_DUPLICATE`

What it means:

- more than one platform `User` record shares the same normalized email

Risk level:

- high

Likely cause:

- earlier experimental linkage or manual inserts
- environment copy/reseed effects
- historic data drift before uniqueness assumptions were enforced consistently

Operator review steps:

1. identify all `User` rows sharing the normalized email
2. inspect which employees, if any, each user is linked to
3. inspect whether either user has `UserIdentity` rows
4. determine which user record should remain authoritative

Safe remediation path:

1. stop automated backfill for the affected email until the duplicate users are understood
2. select one authoritative user record based on actual linkage and identity evidence
3. clean up duplicate user records in a controlled maintenance step later
4. rerun coverage and employee diagnostics afterward

When not to auto-fix:

- when both users have meaningful historical linkage
- when provider identity evidence points to different real people
- when the correct canonical user cannot be established confidently

## `EMPLOYEE_USER_EMAIL_MISMATCH`

What it means:

- the employee email and linked user email do not match after normalization

Risk level:

- high

Likely cause:

- employee email changed but linked user email was not updated
- user was linked to the wrong employee
- copied/test data created an inconsistent relationship

Operator review steps:

1. confirm the current authoritative employee email
2. inspect the linked user email and linked user identities
3. determine whether the employee changed email legitimately or the linkage is wrong
4. check whether additional duplicate flags are present

Safe remediation path:

1. if the employee email changed legitimately, plan a controlled user-email alignment step later
2. if the wrong user is linked, document the conflict and defer to a controlled cleanup workflow
3. keep the current read-only diagnostics in place until canonical ownership is clear

When not to auto-fix:

- when the user has provider identities and the mismatch source is unclear
- when multiple employees or users are implicated
- when the correct canonical email cannot be proven

## `USER_LINKED_TO_MULTIPLE_EMPLOYEES`

What it means:

- one `User` record is linked to more than one employee record

Risk level:

- high

Likely cause:

- duplicate employee records
- earlier manual linkage or experimental data repair
- copied environment data with ambiguous merges

Operator review steps:

1. list all employee ids tied to the same user
2. determine whether one employee is obsolete or duplicated
3. compare employee status and business context
4. inspect whether the user has provider identity evidence pointing to one canonical employee

Safe remediation path:

1. resolve the employee duplication or incorrect linkage first
2. keep one canonical employee-to-user relationship
3. re-run diagnostics after the cleanup step

When not to auto-fix:

- when both employees appear active or materially different
- when historical audit context must be preserved before any relinking
- when operator confidence is low about which employee should remain linked

## `USER_WITHOUT_IDENTITY`

What it means:

- a linked user exists, but no `UserIdentity` record exists yet

Risk level:

- low to medium

Likely cause:

- the user was created through backfill only
- the employee has not completed Microsoft Entra sign-in since scaffolding was added
- this is an expected transitional state

Operator review steps:

1. confirm the employee-to-user link is otherwise correct
2. verify there are no mismatch or duplicate flags for the same employee
3. determine whether the employee is expected to sign in through Microsoft Entra

Safe remediation path:

1. allow the next successful Microsoft Entra sign-in to create the `UserIdentity`
2. if the user remains backfill-only for a while, continue monitoring rather than forcing provider linkage

When not to auto-fix:

- do not create provider identity records without real provider evidence
- do not guess provider account ids or external identity values

## Safe Use Of Backfill

Backfill is safest when:

- there are no duplicate employee email flags
- there are no duplicate user email flags
- there is no employee/user mismatch flag
- there is no multi-employee-per-user flag

Backfill should remain preview-first when any of those conflicts exist.

## Escalation Guidance

Escalate before making cleanup decisions when:

- more than one canonical record could be correct
- provider identity evidence conflicts with employee data
- the same issue appears across multiple employees or users
- production-like copied data may have been partially repaired already

## Recommended Next Phase

The next low-risk phase should be operator workflow support:

1. link the admin diagnostics panel to preview-only backfill coverage details
2. add a small operator checklist for resolving each flag in sequence
3. keep the UI read-only until remediation patterns are stable

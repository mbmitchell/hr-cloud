# PostgreSQL Rehearsal Notes

## Purpose

This branch is a PostgreSQL rehearsal only.

- branch: `postgres-rehearsal`
- not a production migration
- not a SaaS tenant phase
- no production data migration
- existing MySQL migration history preserved under `prisma/migrations/`

## Changes Made

### Prisma provider

Updated [prisma/schema.prisma](/Users/mmitchell/dev/hr-cloud/prisma/schema.prisma:1):

- changed datasource provider from `mysql` to `postgresql`

### Example database URL

Updated [.env.example](/Users/mmitchell/dev/hr-cloud/.env.example:1):

- changed `DATABASE_URL` placeholder to PostgreSQL format
- placeholder only, no real credentials committed

Example placeholder now used:

```dotenv
DATABASE_URL="postgresql://HR_CLOUD_DB_USER:HR_CLOUD_DB_PASSWORD@localhost:5432/hr_cloud?schema=public"
```

### PostgreSQL baseline artifact

Generated a fresh PostgreSQL rehearsal baseline SQL file at:

- [prisma/postgres-rehearsal/postgres_baseline_rehearsal.sql](/Users/mmitchell/dev/hr-cloud/prisma/postgres-rehearsal/postgres_baseline_rehearsal.sql:1)

This baseline was generated from the current logical Prisma schema and does not reuse the MySQL migration SQL files.

### Platform identity foundation artifact

Added the low-risk Phase 3 identity foundation in [prisma/schema.prisma](/Users/mmitchell/dev/hr-cloud/prisma/schema.prisma:1):

- `Organization`
- `User`
- `OrganizationMembership`
- `UserIdentity`
- nullable `Employee.organizationId`
- nullable `Employee.userId`

Generated the rehearsal migration artifact at:

- [prisma/postgres-rehearsal/migrations/platform_identity_foundation/migration.sql](/Users/mmitchell/dev/hr-cloud/prisma/postgres-rehearsal/migrations/platform_identity_foundation/migration.sql:1)

This artifact includes:

- schema changes for the new identity models
- indexes and uniqueness constraints for the new identity relations
- a default `Organization` insert using slug `default-org`
- a backfill update that assigns existing `Employee` rows to that default organization when `organizationId` is null

## Commands Used

### Prisma client generation

```bash
npx prisma generate
```

Result:

- succeeded

### PostgreSQL baseline SQL generation

```bash
npx prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script --output prisma/postgres-rehearsal/postgres_baseline_rehearsal.sql
```

Result:

- succeeded

### PostgreSQL baseline migration via `migrate dev`

Requested command:

```bash
npx prisma migrate dev --name postgres_baseline_rehearsal
```

Result:

- not run

Reason:

- this branch moved to the safer cutover-rehearsal path using a temporary PostgreSQL migration workspace instead of generating a new `migrate dev` baseline inside the legacy MySQL migration directory
- the active validation path is documented below under `PostgreSQL cutover rehearsal via temporary migration workspace`

### Platform identity migration via `migrate dev`

Requested command:

```bash
npx prisma migrate dev --name platform_identity_foundation
```

Result:

- failed before migration execution

Exact error:

```text
Error validating datasource `db`: the URL must start with the protocol `postgresql://` or `postgres://`.
```

Reason:

- at that earlier point, the local datasource was not yet wired to scratch PostgreSQL
- Prisma rejected the attempted `migrate dev` run before migration execution

### PostgreSQL cutover rehearsal via temporary migration workspace

After Neon scratch connectivity was confirmed, the PostgreSQL lineage was
validated without changing the repo's legacy MySQL migrations directory.

Temporary strategy used:

1. create a temporary Prisma workspace under `/private/tmp`
2. copy [prisma/schema.prisma](/Users/mmitchell/dev/hr-cloud/prisma/schema.prisma:1) into that temp workspace
3. copy PostgreSQL lineage files from [prisma/postgresql-migrations](/Users/mmitchell/dev/hr-cloud/prisma/postgresql-migrations/) into the temp workspace `prisma/migrations/` folder
4. run Prisma migration commands against the temp schema path

Commands run:

```bash
npx prisma migrate reset --force --skip-generate --skip-seed --schema /private/tmp/.../prisma/schema.prisma
```

```bash
npx prisma migrate deploy --schema /private/tmp/.../prisma/schema.prisma
```

Results:

- baseline applied cleanly
- `platform_identity_foundation` applied cleanly
- the scratch database `_prisma_migrations` table recorded both PostgreSQL migrations

Scratch-data verification:

- inserted one rehearsal `Employee` row after the baseline migration
- verified one `Organization` row created with slug `default-org`
- verified the rehearsal employee was backfilled to `organizationId = '00000000-0000-4000-8000-000000000001'`
- verified `userId` remained null, as intended for this phase

## Baseline Generation Outcome

The current logical Prisma schema produced PostgreSQL DDL successfully.

Observed compatibility signals from the generated SQL:

- Prisma enums mapped to PostgreSQL enums
- `Json` fields mapped to `JSONB`
- `@db.Decimal` fields mapped to `DECIMAL`
- `DateTime` fields mapped to `TIMESTAMP(3)`
- Prisma `Boolean` fields mapped cleanly

## Schema Fields Prisma Rejected Under PostgreSQL

- none encountered during `prisma generate`
- none encountered during `prisma migrate diff`

## Errors Encountered

- no Prisma schema errors encountered in this rehearsal
- no PostgreSQL baseline generation errors encountered
- an earlier `npx prisma migrate dev --name platform_identity_foundation` attempt failed with datasource URL validation before the scratch PostgreSQL datasource was wired up
- the first sandboxed `prisma migrate reset` attempt returned a generic schema engine error; rerunning outside the sandbox against the scratch database succeeded

## Build Result

Command run:

```bash
npm run build
```

Result:

- succeeded
- still succeeded after the cutover rehearsal validation

## Warnings Observed

### Next.js workspace root warning

Current state:

- not observed after adding `outputFileTracingRoot` in [next.config.ts](/Users/mmitchell/dev/hr-cloud/next.config.ts:1)

This warning was seen earlier in the branch history, but is currently addressed by the config-only workspace root pin.

### Dev auth warning

Build warning:

- `AUTH_ENABLE_DEV_AUTH=true outside development`

This comes from the current local `.env` and is unrelated to the PostgreSQL rehearsal branch changes.

## What This Rehearsal Proves

- the current logical Prisma schema can be rendered into PostgreSQL DDL
- Prisma Client generation still works with the schema provider set to PostgreSQL
- the application still builds after the provider switch
- the separate PostgreSQL migration lineage can be validated safely without mutating the legacy MySQL migrations folder
- the PostgreSQL baseline and `platform_identity_foundation` migrations apply cleanly to a scratch Neon database
- the default organization insert and `Employee.organizationId` backfill logic work as intended

## What This Rehearsal Does Not Prove Yet

- that production MySQL data migrates cleanly
- that all application workflows behave identically against PostgreSQL
- that the existing MySQL migration history can be reused on PostgreSQL
- that auth identity linking works against the new `User` and `UserIdentity` tables
- that tenant enforcement is correct across business tables and APIs

## Rollback Instructions

If you want to abandon this rehearsal branch:

1. switch back to the non-rehearsal branch
2. revert `prisma/schema.prisma` datasource provider to `mysql`
3. revert `.env.example` to the non-rehearsal placeholder if desired
4. remove `prisma/postgres-rehearsal/` if the rehearsal artifacts should not be kept

If you want to keep this branch but back out the provider change:

1. change `provider = "postgresql"` back to `provider = "mysql"`
2. regenerate Prisma Client
3. keep the rehearsal notes and generated SQL as reference only

If you want to roll back only the platform identity foundation work:

1. remove `Organization`, `User`, `OrganizationMembership`, and `UserIdentity` from `prisma/schema.prisma`
2. remove nullable `organizationId` and `userId` from `Employee`
3. delete [prisma/postgres-rehearsal/migrations/platform_identity_foundation/migration.sql](/Users/mmitchell/dev/hr-cloud/prisma/postgres-rehearsal/migrations/platform_identity_foundation/migration.sql:1)
4. regenerate Prisma Client
5. keep this note documenting why the phase was abandoned if useful for later retries

## Recommended Next Step

The next exact step should be the first post-cutover application phase:

1. keep the PostgreSQL lineage as the cloud branch migration source of truth
2. do not begin tenant enforcement yet
3. add low-risk auth identity linkage between existing employee login flow and the new `User` / `UserIdentity` records
4. keep login behavior unchanged while introducing the linkage scaffolding

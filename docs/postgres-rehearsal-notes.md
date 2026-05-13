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

- the current local `.env` still points at a MySQL `DATABASE_URL`
- no scratch PostgreSQL database was available in this workspace for safe rehearsal use

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

## Build Result

Command run:

```bash
npm run build
```

Result:

- succeeded

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

## What This Rehearsal Does Not Prove Yet

- that the baseline applies successfully to a real PostgreSQL database
- that production MySQL data migrates cleanly
- that all application workflows behave identically against PostgreSQL
- that the existing MySQL migration history can be reused on PostgreSQL

## Rollback Instructions

If you want to abandon this rehearsal branch:

1. switch back to the non-rehearsal branch
2. revert `prisma/schema.prisma` datasource provider to `mysql`
3. revert `.env.example` to the non-rehearsal placeholder if desired
4. remove `prisma/postgres-rehearsal/` if the rehearsal artifact should not be kept

If you want to keep this branch but back out the provider change:

1. change `provider = "postgresql"` back to `provider = "mysql"`
2. regenerate Prisma Client
3. keep the rehearsal notes and generated SQL as reference only

## Recommended Next Step

The next exact step should be a real scratch-database rehearsal:

1. provision a disposable PostgreSQL database
2. set a temporary PostgreSQL `DATABASE_URL` outside git
3. run:

```bash
npx prisma migrate dev --name postgres_baseline_rehearsal
```

4. re-run:

```bash
npx prisma generate
npm run build
```

5. validate that the generated baseline applies cleanly without manual SQL edits

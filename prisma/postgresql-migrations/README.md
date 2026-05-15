# PostgreSQL Migration Lineage

This directory holds the clean PostgreSQL migration lineage for the `hr-cloud`
SaaS/cloud branch.

It is intentionally separate from the legacy MySQL Prisma migrations in
`prisma/migrations/`.

## Why This Exists

- `prisma/migrations/` was created under the MySQL provider
- Prisma tracks the provider in `migration_lock.toml`
- PostgreSQL `migrate dev` rejects the MySQL lineage with `P3019`
- the cloud branch needs a fresh PostgreSQL baseline lineage instead of trying
  to replay MySQL SQL against PostgreSQL

## Current Structure

- `00000000000000_postgresql_baseline/`
  - baseline PostgreSQL DDL generated from the logical Prisma schema
- `20260514000000_platform_identity_foundation/`
  - low-risk platform identity foundation phase for SaaS preparation
- `migration_lock.toml`
  - prepared with `provider = "postgresql"` for future cutover

## Important

- This folder is the recommended PostgreSQL lineage source of truth for cloud
  work.
- Prisma will not automatically use this folder while `prisma/migrations/`
  remains the active migrations directory.
- Do not delete the MySQL migrations. Keep them for historical reference and
  rollback analysis.

# PostgreSQL Migration Lineage

## Summary

The `hr-cloud` SaaS/cloud branch now has two migration histories on disk:

- legacy MySQL Prisma migrations in [prisma/migrations](/Users/mmitchell/dev/hr-cloud/prisma/migrations/)
- a clean PostgreSQL lineage in [prisma/postgresql-migrations](/Users/mmitchell/dev/hr-cloud/prisma/postgresql-migrations/)

This is intentional.

The MySQL lineage is preserved for history and reference. The PostgreSQL
lineage is the clean path forward for cloud/SaaS environments.

## Why The MySQL Migration History Cannot Be Reused Directly

Prisma migration history is provider-specific.

The existing [migration_lock.toml](/Users/mmitchell/dev/hr-cloud/prisma/migrations/migration_lock.toml:1)
declares:

```toml
provider = "mysql"
```

That means Prisma expects the entire active migration chain in
`prisma/migrations/` to belong to MySQL. Once the datasource provider changes to
PostgreSQL, Prisma will reject that existing chain with `P3019` instead of
trying to mix providers inside one lineage.

There are also SQL-level reasons the old chain should not be replayed on
PostgreSQL:

- the historical SQL was generated for MySQL syntax
- column, enum, JSON, and timestamp behavior differ between providers
- migration ordering and lock metadata were established under MySQL
- replaying provider-mismatched SQL would make the cloud branch harder to trust

## Why PostgreSQL Requires A Fresh Baseline Lineage

PostgreSQL should start from a clean baseline for this branch because:

- the logical Prisma schema now targets PostgreSQL
- the cloud branch is intentionally separating from MFN internal production
- SaaS foundation work should build on one provider-consistent migration chain
- future tenant-aware changes need a stable PostgreSQL history

Recommended approach:

1. generate one PostgreSQL baseline from the current logical schema
2. layer new PostgreSQL-only migrations on top of that baseline
3. keep MySQL history unchanged as an archive/reference chain

## Recommended PostgreSQL Migration Structure

Current recommended structure:

- [prisma/migrations](/Users/mmitchell/dev/hr-cloud/prisma/migrations/)
  - legacy MySQL lineage
  - preserved for reference only
- [prisma/postgresql-migrations/00000000000000_postgresql_baseline/migration.sql](/Users/mmitchell/dev/hr-cloud/prisma/postgresql-migrations/00000000000000_postgresql_baseline/migration.sql:1)
  - clean PostgreSQL baseline
- [prisma/postgresql-migrations/20260514000000_platform_identity_foundation/migration.sql](/Users/mmitchell/dev/hr-cloud/prisma/postgresql-migrations/20260514000000_platform_identity_foundation/migration.sql:1)
  - first PostgreSQL follow-up migration for platform identity foundation
- [prisma/postgresql-migrations/migration_lock.toml](/Users/mmitchell/dev/hr-cloud/prisma/postgresql-migrations/migration_lock.toml:1)
  - prepared PostgreSQL provider lockfile

## How Historical Migrations Are Preserved Safely

The legacy MySQL migrations are not deleted, rewritten, or force-converted.

They remain in place so the team keeps:

- the exact historical evolution of the internal MFN app
- reference SQL for debugging older environments
- rollback context for the pre-cloud system
- a clear audit trail showing where the provider split happened

The PostgreSQL lineage is additive and separate. That separation is the safety
mechanism.

## Clean-Baseline Approach For PostgreSQL SaaS Environments

For new cloud/SaaS PostgreSQL environments, the recommended setup is:

1. treat `prisma/postgresql-migrations/` as the canonical PostgreSQL history
2. apply the PostgreSQL baseline to an empty PostgreSQL database
3. apply PostgreSQL follow-up migrations in order
4. do not replay `prisma/migrations/` against PostgreSQL
5. do not attempt production MySQL data migration in the same step

When the branch is ready for a formal Prisma cutover, do it in a dedicated PR:

1. preserve the current MySQL history in place or archive it to a clearly named folder such as `prisma/mysql-migrations-archive/`
2. replace the active Prisma migrations directory with the PostgreSQL lineage
3. ensure the active `migration_lock.toml` says `provider = "postgresql"`
4. run Prisma migration validation against a disposable PostgreSQL database
5. only then standardize future cloud migrations on the PostgreSQL chain

## Rollback Strategy

If the PostgreSQL lineage work needs to be backed out:

1. keep `prisma/migrations/` untouched
2. revert the provider change in [prisma/schema.prisma](/Users/mmitchell/dev/hr-cloud/prisma/schema.prisma:1) if needed
3. remove [prisma/postgresql-migrations](/Users/mmitchell/dev/hr-cloud/prisma/postgresql-migrations/) only if the branch should fully abandon PostgreSQL rehearsal work
4. keep the documentation files so the rationale and failure mode remain visible

If only the PostgreSQL lineage layout needs to change later:

1. keep the SQL files
2. move or rename the PostgreSQL lineage folder in one dedicated follow-up change
3. do not rewrite the preserved MySQL migration SQL

## Future Migration Expectations

Going forward, cloud/SaaS database work should assume:

- PostgreSQL is the target provider
- each new migration should be generated from the PostgreSQL lineage only
- provider changes must never be mixed into one Prisma migration chain
- schema-only foundation phases should land before tenant enforcement phases
- production data migration planning should happen separately from schema lineage setup

## Recommended Next Phase

The next implementation phase should be a Prisma cutover rehearsal for the
cloud branch only:

1. validate the PostgreSQL lineage against an empty scratch PostgreSQL database
2. confirm the baseline and `platform_identity_foundation` migrations apply cleanly
3. decide the exact branch step where `prisma/postgresql-migrations/` becomes the active Prisma migrations directory
4. only after that, continue with the next low-risk SaaS phase such as linking auth identities to `User` and `Employee` without changing login behavior yet

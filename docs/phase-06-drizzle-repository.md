# Phase 6 — `@kit/drizzle`, part two: the repository

**Goal:** `BaseCrudRepository` — the SQL-speaking, framework-free layer with exactly five public
operations. Usable from a script, a worker, or a test with no Nest runtime.

**Depends on:** Phase 5. **Blocks:** Phase 7.
**Open decision:** **#1 — soft-delete default.** Recommended: soft-delete only on tables that
declare a `deletedAt` column, detected at construction, so tables without it are never silently
hard-deleted.

## Why this matters

This is the layer that must stay portable. It speaks SQL and nothing else — no HTTP semantics,
no business rules (those live in Phase 7's service). Every method takes an optional `tx`, so any
call can join a caller's transaction or run on the base connection. That single affordance is
what lets the service do a transactional read-diff-write without the repository knowing anything
about it.

## The five-method contract

`create · update · delete · search · getById` — everything else is `protected` or internal.

## Implementation targets

### `repository/base-crud.repository.ts`
- [ ] `getById(pk, opts?)` — returns the row or `null`; excludes soft-deleted rows unless
      `includeDeleted`.
- [ ] `search(query, opts?)` — returns `{ items, nextCursor, total? }`. Cursors encode the sort
      key + PK tiebreak for stable pagination under concurrent inserts. (`total` per decision #2.)
- [ ] `create(values, tx?)`.
- [ ] `update(pk, patch, opts?)` — writes the **already-minimised patch** as given (the repo does
      not diff). With `expectedVersion`, performs optimistic locking via
      `` sql`${table.version} + 1` `` and throws `ConflictError` when zero rows match.
- [ ] `delete(pk, opts?)` — soft by default where supported, `hard: true` to force.
- [ ] Protected primitives: `exists`, `count`, `transaction`, `buildWhere`, `defaultSort`,
      `softDeleteFilter`.

### Cross-cutting behaviour
- [ ] Every method accepts an optional `tx` (`DbOrTx`) and joins it when passed.
- [ ] **Composite primary keys** supported; `pk.ts` resolves them via `getTableConfig`.
- [ ] Soft-deleted rows excluded from `getById` and `search` unless `includeDeleted: true`.

### `writes/` and `transaction/`
- [ ] `syncChildren(tx, childTable, parentKey, rows)` — bulk delete + `insert … onConflictDoUpdate`
      in a **constant** number of queries regardless of row count.
- [ ] `withTransaction`, `TransactionHost` (AsyncLocalStorage) — the binding the Nest
      `TransactionInterceptor` will drive in Phase 7.

### `search/` and `seed/`
- [ ] `trigramSearch(table, column, term, threshold)` using `pg_trgm`.
- [ ] `seedTable` (`onConflictDoNothing`) and `seedInOrder` (respects FK ordering).

## Verification gate

- [ ] **Integration tests against a real Postgres in Docker** (not a mock).
- [ ] A **composite-PK table** exercised through all five methods.
- [ ] A **concurrent-update test** proving `ConflictError` fires on a stale `expectedVersion`.

## Notes and pitfalls

- The repository never diffs and never throws `NotFoundError` on a missing `getById` — that is
  the service's job. Returning `null` here is the deliberate difference between the two layers.
- Keep this package free of any `@kit/nest` import. Dependencies point downward only.

# @kit — Roadmap

This roadmap tracks **building** the `@kit` toolkit. The authoritative specification is
[`kit-README.md`](./kit-README.md); this file turns its build plan into a checklist of
milestones, gates, and blockers. All boxes start unchecked — no implementation exists yet,
only the workspace scaffold.

Four rules gate every phase and are never traded away:

- **Stay minimal.** Do not re-implement what a well-known library already does. lodash-es,
  date-fns, type-fest, `@ts-rest/core`, `qs`, drizzle-seed, nestjs-zod, `@nestjs/config`,
  `@nestjs/terminus` and `@nestjs/passport` cover the everyday work — the kit only holds
  what none of them do. See the table in [`kit-README.md`](./kit-README.md).
- **Dependencies point strictly downward** (see order below). `@kit/nest` may import
  `@kit/drizzle`; never the reverse.
- **Every cross-package dependency is a peer dependency**, never a direct one. Two copies of
  Zod or Drizzle in one process is a day-long bug.
- **Promotion rule:** nothing enters the library until it has been written a third time *and*
  no library already does it. Two occurrences is a coincidence; three is a pattern.

## Package dependency order (build bottom-up)

```
@kit/core      zero runtime deps                                    ← browser-safe
    ↑
@kit/zod       peer: zod                                            ← browser-safe
    ↑
@kit/http      peer: zod, @ts-rest/core, qs                         ← browser-safe
    ↑
@kit/drizzle   peer: drizzle-orm, pg, deep-object-diff, lodash-es   ← server only
    ↑
@kit/nest      peer: @nestjs/common, @nestjs/core, nestjs-zod       ← server only
    ↑
@kit/testing   peer: vitest                                         ← dev only
```

## Pre-flight — pin versions (do first)

- [ ] Confirm and pin exact majors before scaffolding depends on them. Versions found on
      2026-08-28 (differences from the README's assumptions flagged):
  - `drizzle-orm@0.45.2`
  - `zod@4.4.3` — **major 4** (blocks Open Decision 5 / Phase 3)
  - `@nestjs/common@12.0.1`, `@nestjs/core@12.0.1`
  - `deep-object-diff@1.1.9`
  - `typescript` — latest is `7.0.2` (**major 7, the native rewrite**) but `typescript-eslint`
    and much current tooling do **not** support it yet, so the workspace is pinned to
    `~5.9.3`. Revisit once the ecosystem catches up.
  - `pg@8.23.0`, `@ts-rest/core@3.52.1`, `vitest@4.1.11`
- [ ] Pin the peers the kit now leans on instead of re-implementing: `qs`, `lodash-es`,
      `nestjs-zod`. Projects consuming the kit add `date-fns`, `type-fest`, `drizzle-zod`,
      `@nestjs/config`, `@nestjs/terminus`, `@nestjs/passport`, `drizzle-seed`, `fishery`
      themselves as needed — the kit does not depend on them.

## Open decisions — resolve before they block their phase

Each must be answered explicitly; do not let the code silently choose.

- [ ] **Soft-delete default** — soft-delete on every table, or only where a `deletedAt`
      column is declared (detected at construction)? *Blocks Phase 6.*
- [ ] **`search` + `total`** — opt-in per request (`?withTotal=true`) or never returned with
      cursor pagination? *Blocks Phase 5 / 6.*
- [ ] **Expand implementation** — Drizzle relational `with` vs explicit joins; behaviour at
      two levels of nesting. *Blocks Phase 5.*
- [ ] **`Ctx` shape** — explicit parameter (more testable) vs ambient via `AsyncLocalStorage`
      (less noisy). *Blocks Phase 7.*
- [ ] **Zod version / `buildFilterSchema`** — confirm the DSL expresses cleanly on the pinned
      major. *Blocks Phase 3.*

## Milestones

Complete and verify each phase before starting the next — do not scaffold everything and
then debug.

- [x] **Phase 1 — Workspace scaffold**
      Scope: `pnpm-workspace.yaml`, `tsconfig.base.json`, six packages with correct peer
      deps + barrels, changesets, root scripts. *(directory/config scaffold in place;
      remaining gate item below)*
      Gate: `pnpm install && pnpm -r build` passes; a plain Node script imports `@kit/core`.

- [ ] **Phase 2 — `@kit/core`**
      Scope: the `AppError` hierarchy and `invariant`/`assertNever`.
      *Not here:* `Result` (→ neverthrow); array/object/string/number/date/async helpers
      (→ lodash-es, date-fns, nanoid, p-*); type helpers (→ type-fest); anything
      domain-opinionated like money/cents (→ project `utils/`).
      Gate: 100% of exports have tests; `pnpm why` shows zero runtime dependencies.

- [ ] **Phase 3 — `@kit/zod`**
      Scope: the opinionated primitives (`zSlug`, `zEnumFrom`, `zTrimmed`), `zCsvArray`,
      `atLeastOneOf`, `buildFilterSchema`, `buildExpandSchema`, `buildQuerySchema`.
      *Not here:* `zUuid/zEmail/zUrl/zIsoDate/…` — use zod v4 built-ins directly; entity
      create/update/select schemas — use drizzle-zod (Phase 5) with `.omit()`.
      Gate: a test proves an unlisted filter field, an unlisted expand path, and a
      past-`maxDepth` filter are each rejected with a message naming the offender.

- [ ] **Phase 4 — `@kit/http`**
      Scope: envelopes, cursor encode/decode, and `qs`-backed `parseBracketQuery` /
      `parseCompactQuery`.
      *Not here:* the custom typed client + interceptors — use `@ts-rest/core`'s client.
      Gate: round-trip property test `decodeCursor(encodeCursor(x)) === x`; parser tests for
      both wire syntaxes including malformed input.

- [ ] **Phase 5 — `@kit/drizzle` part one: foundations**
      Scope: types, column presets, naming helpers, `buildWhere`, `applySort`, `applyCursor`,
      `buildExpand`, `computePatch`.
      Gate: `computePatch` has explicit tests for every wrapper behaviour — atomic arrays,
      `Date` normalisation, omitted-vs-null, ignored meta keys.

- [ ] **Phase 6 — `@kit/drizzle` part two: the repository**
      Scope: `BaseCrudRepository` (five methods), composite PK, soft delete, optimistic
      locking, `syncChildren`, `TransactionHost`.
      *Not here:* seeding (→ drizzle-seed) and `trigramSearch` (inline raw `sql`).
      Gate: integration tests against a real Postgres in Docker, including a composite-PK
      table and a concurrent-update test proving `ConflictError` fires.

- [ ] **Phase 7 — `@kit/nest`**
      Scope: `DbModule`, `BaseCrudService` (transactional read-diff-write), `createCrudController`,
      `QueryParsePipe`/`ParsePkPipe`, `AppErrorFilter`/`PostgresExceptionFilter`,
      `TransactionInterceptor`/`NoopUpdateInterceptor`, `createApp()`.
      *Not here:* config (→ `@nestjs/config`), health (→ `@nestjs/terminus`), auth guards
      (→ `@nestjs/passport`), Zod pipe/filter (→ nestjs-zod), logging (→ nestjs-pino).
      Gate: an example app exposes full CRUD; updating one field of ten issues an UPDATE
      touching exactly that field, and an empty update issues no UPDATE at all.

- [ ] **Phase 8 — `@kit/testing` and docs**
      Scope: `withTestDb`, `createTestingModule`, and a README per package with a runnable
      example. *Not here:* factories (→ fishery + @faker-js/faker).
      Gate: `pnpm -r test` green from a clean clone.

## Definition of done (acceptance criteria)

- [ ] `pnpm install && pnpm -r build && pnpm -r test` passes from a clean clone
- [ ] `@kit/core` has zero runtime dependencies; `@kit/zod` and `@kit/http` import nothing
      from `@kit/drizzle` or `@kit/nest`
- [ ] A browser bundle importing `@kit/core`, `@kit/zod`, `@kit/http` contains no NestJS and
      no `pg`
- [ ] Updating one field of a ten-field entity issues an UPDATE naming one column
- [ ] Updating with an identical payload issues no UPDATE and reports `noop: true`
- [ ] A concurrent update with a stale `expectedVersion` throws `ConflictError`
- [ ] `search` with 300 child rows and `expand` issues a constant number of queries
- [ ] Unlisted filter fields, unlisted expand paths, and over-depth nesting all return 400

# Phase 8 — `@kit/testing` and docs

**Goal:** the dev-only test helpers that make the rest of the toolkit pleasant to test, plus a
runnable README per package. This is the phase that lets a fresh clone go green with one command.

**Depends on:** Phases 2–7. **Blocks:** nothing (final phase).
**Open decisions:** none.

## Why this matters

Every prior phase asserted a testing gate; this phase provides the shared machinery those tests
lean on — deterministic factories and a transactional test database that rolls back after each
test, so integration tests are isolated without truncating between runs.

## Implementation targets

### `factories/`
- [ ] `buildFactory<T>(defaults)` — deterministic defaults with per-call overrides.

### `db/`
- [ ] `withTestDb` — runs each test inside a transaction that is **rolled back** afterwards.
- [ ] `truncateAll` — for the cases that genuinely need a clean slate.

### `nest/`
- [ ] `createTestingModule` — a Nest testing module with the standard overrides pre-wired.

### Docs
- [ ] A `README.md` per package (`core`, `zod`, `http`, `drizzle`, `nest`, `testing`) with a
      **runnable** example.
- [ ] Cross-link each package README back to this guide and the [ROADMAP](../ROADMAP.md).

## Verification gate

- [ ] `pnpm -r test` is **green from a clean clone** (`git clone … && pnpm install && pnpm -r test`).

## Final acceptance (whole project)

With this phase done, tick the remaining boxes in
[ROADMAP → Definition of done](../ROADMAP.md#definition-of-done-acceptance-criteria):

- [ ] `pnpm install && pnpm -r build && pnpm -r test` passes from a clean clone.
- [ ] `@kit/core` has zero runtime deps; `@kit/zod`/`@kit/http` import nothing from
      `@kit/drizzle`/`@kit/nest`.
- [ ] A browser bundle of `@kit/core` + `@kit/zod` + `@kit/http` contains no NestJS and no `pg`.
- [ ] One-field update issues a one-column UPDATE; identical payload issues none (`noop: true`).
- [ ] Stale `expectedVersion` throws `ConflictError`.
- [ ] `search` with 300 child rows + `expand` issues a **constant** number of queries.
- [ ] Unlisted filter fields, unlisted expand paths, and over-depth nesting all return `400`.

## Notes and pitfalls

- `withTestDb`'s rollback strategy only isolates work done on the injected `tx`; code that opens
  its own connection escapes the rollback. Route everything through the `DbOrTx` seam from
  Phase 6.
- Keep `@kit/testing` a dev-only peer of `vitest`; it must never end up in a production bundle.

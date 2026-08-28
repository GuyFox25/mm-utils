# kit

A layered, **domain-agnostic** TypeScript toolkit — the code that keeps getting rewritten
across our backends, extracted once and done right: generic Drizzle repositories, NestJS
base services, and the cross-cutting concerns every service needs on day one.

It knows about tables, primary keys, cursors, transactions, diffs and HTTP status codes.
It knows nothing about orders, users, cards or matches. Domain code stays in each project's
own `utils/`; only patterns written a **third** time are promoted here.

> Replace the `@kit` scope with your real npm scope before publishing.

## Documentation

| Document | Purpose |
|---|---|
| [`kit-README.md`](./kit-README.md) | The authoritative **specification**. |
| [`ROADMAP.md`](./ROADMAP.md) | Build phases, gates, and open decisions at a glance. |
| [`docs/`](./docs) | A thorough, per-phase guide with implementation targets and checklists. |

Start with [`docs/README.md`](./docs/README.md).

## Packages

Dependencies point strictly **downward**; every cross-package dependency is a **peer**
dependency. A React bundle must never pull in NestJS or `pg`, so this is six packages, not
one.

```
@kit/core      zero runtime deps                        ← browser-safe
    ↑
@kit/zod       peer: zod                                ← browser-safe
    ↑
@kit/http      peer: zod, @ts-rest/core                 ← browser-safe
    ↑
@kit/drizzle   peer: drizzle-orm, pg, deep-object-diff  ← server only
    ↑
@kit/nest      peer: @nestjs/common, @nestjs/core       ← server only
    ↑
@kit/testing   peer: vitest                             ← dev only
```

| Package | What lives here |
|---|---|
| [`@kit/core`](./packages/core) | Types, `Result`, the `AppError` hierarchy, guards, pure utilities. |
| [`@kit/zod`](./packages/zod) | Zod primitives, coercion, and the filter/expand/query DSL. |
| [`@kit/http`](./packages/http) | Envelopes, cursors, query-string parsing, ts-rest contracts, typed client. |
| [`@kit/drizzle`](./packages/drizzle) | `BaseCrudRepository`, column presets, query/diff machinery. |
| [`@kit/nest`](./packages/nest) | `BaseCrudService`, controller factory, pipes, guards, filters, interceptors. |
| [`@kit/testing`](./packages/testing) | Factories, transactional test DB, pre-wired Nest testing module. |

## Getting started

```bash
pnpm install       # install the workspace
pnpm build         # build every package (pnpm -r build)
pnpm test          # run all tests
pnpm typecheck     # tsc --noEmit across packages
pnpm lint          # eslint across packages
```

Requires **Node ≥ 20** and **pnpm 11**.

### Workspace scripts

| Script | Action |
|---|---|
| `pnpm build` | `tsc` build every package in dependency order. |
| `pnpm dev` | Watch-build all packages in parallel. |
| `pnpm clean` | Remove every `dist/`. |
| `pnpm typecheck` | Type-check without emitting. |
| `pnpm lint` | ESLint across `src/`. |
| `pnpm test` / `pnpm test:watch` | Vitest, run-once / watch. |
| `pnpm changeset` | Record a version bump. |
| `pnpm release` | Build, then `changeset publish`. |

## Conventions

- No `any` — use `unknown` and narrow. Explicit return types on every exported function.
- Arrow functions over `function` declarations. Blank line before every `return`.
- Every public export has a TSDoc comment with at least one example.
- Every package has an `index.ts` barrel; deep imports into `src/` are unsupported.
- Money is integer cents. Timestamps are `timestamptz`. Constraint names use the
  `idx_` / `uq_` / `fk_` / `chk_` prefixes.

## Status

Scaffolding is in place (**Phase 1**). Implementation proceeds one phase at a time — each
phase is verified before the next begins. See [`ROADMAP.md`](./ROADMAP.md).

## Toolchain note

The latest `typescript` is `7.x` (the native rewrite), but `typescript-eslint` and much of
the current tooling do not support it yet, so the workspace is pinned to `typescript ~5.9`.
Revisit once the ecosystem catches up.

# @kit — implementation guide

This folder expands the [build plan](../ROADMAP.md) into a working manual: one document per
phase, each with the reasoning, the concrete implementation targets, a checklist you can tick
off, and the gate that must pass before the next phase begins.

Read these alongside [`kit-README.md`](../kit-README.md), which remains the authoritative
specification. Where the two differ, the README wins — open an issue and fix the doc.

## How to use this guide

- **Build strictly bottom-up.** Each package depends only on the ones below it. Do not start
  a phase until the previous phase's gate is green.
- **One phase at a time.** Complete and verify a phase before scaffolding the next. Do not
  build everything and then debug.
- **Resolve the open decision(s)** listed at the top of a phase *before* you write code for it.
- **The promotion rule still applies inside the library:** if a helper is only used once,
  it does not need to be a public export yet.

## Phases

| # | Package / focus | Document | Gate (one line) |
|---|---|---|---|
| 1 | Workspace scaffold | [phase-01-workspace.md](./phase-01-workspace.md) | `pnpm install && pnpm -r build` passes; a Node script imports `@kit/core`. |
| 2 | `@kit/core` | [phase-02-core.md](./phase-02-core.md) | 100% of exports tested; zero runtime deps. |
| 3 | `@kit/zod` | [phase-03-zod.md](./phase-03-zod.md) | Unlisted filter/expand and over-depth each rejected, naming the offender. |
| 4 | `@kit/http` | [phase-04-http.md](./phase-04-http.md) | Cursor round-trips; both query syntaxes parse, malformed input rejected. |
| 5 | `@kit/drizzle` — foundations | [phase-05-drizzle-foundations.md](./phase-05-drizzle-foundations.md) | `computePatch` tested for every wrapper behaviour. |
| 6 | `@kit/drizzle` — repository | [phase-06-drizzle-repository.md](./phase-06-drizzle-repository.md) | Integration tests on real Postgres; composite PK + `ConflictError`. |
| 7 | `@kit/nest` | [phase-07-nest.md](./phase-07-nest.md) | Example CRUD app; minimal UPDATE and no-op UPDATE proven. |
| 8 | `@kit/testing` + docs | [phase-08-testing-docs.md](./phase-08-testing-docs.md) | `pnpm -r test` green from a clean clone. |

## Cross-phase references

- [Conventions](../README.md#conventions) — the rules every phase follows.
- [Open decisions](../ROADMAP.md#open-decisions--resolve-before-they-block-their-phase) —
  the five unresolved questions and the phase each one blocks.

## Definition of done

The project is complete when every box in [ROADMAP.md → Definition of done](../ROADMAP.md#definition-of-done-acceptance-criteria)
is ticked. In short: clean-clone build+test passes, layering holds (no Nest/`pg` in a browser
bundle), updates are minimal, optimistic locking fires, expand stays constant-query, and every
allow-list violation returns `400`.

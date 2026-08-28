# Phase 1 — Workspace scaffold

**Goal:** a monorepo that installs, builds, and enforces the layering rule — before a single
line of library logic exists. Everything downstream depends on this being correct, so it is
worth getting exactly right.

**Depends on:** nothing. **Blocks:** every other phase.
**Open decisions:** none — but pin versions before you start (see below).

## Why this matters

The critical constraint of the whole project is that **`client` packages import from `@kit`
too**. A React bundle must never pull in NestJS or `pg`. That is only enforceable if this is
several packages with dependencies pointing strictly downward, and if every cross-package
dependency is a **peer** dependency rather than a direct one (two copies of Zod or Drizzle in
one process produce type errors that take a day to diagnose). Phase 1 encodes that constraint
in the workspace itself so later phases cannot accidentally violate it.

## Implementation targets

### Root workspace
- [x] `pnpm-workspace.yaml` globbing `packages/*` (and `examples/*` for Phase 7).
- [x] Root `package.json`: `private: true`, `packageManager` pinned, and the recursive scripts
      (`build`, `dev`, `clean`, `typecheck`, `lint`, `test`, `changeset`, `release`).
- [x] `tsconfig.base.json` with strict options (`strict`, `noUncheckedIndexedAccess`,
      `exactOptionalPropertyTypes`, `verbatimModuleSyntax`, `isolatedModules`) that every
      package extends.
- [x] `.gitignore`, `.npmrc` (`auto-install-peers=false` to keep peer deps explicit).
- [x] Changesets configured (`.changeset/config.json`).
- [x] ESLint flat config encoding the conventions (`no-explicit-any`,
      `explicit-module-boundary-types`, arrow-function preference).

### Six packages
For each of `core`, `zod`, `http`, `drizzle`, `nest`, `testing`:
- [x] `package.json` with the correct **peer** dependencies (never direct) and the standard
      script set; `type: module`, `exports` map, `files: ["dist"]`.
- [x] `tsconfig.json` extending the base, `rootDir: src`, `outDir: dist`.
- [x] `src/index.ts` barrel re-exporting each subfolder.
- [x] The full subfolder tree from the spec, each folder an ES module placeholder.

### Version pinning (do not trust memory)
- [x] Run `pnpm view <pkg> version` for `drizzle-orm`, `zod`, `@nestjs/common`,
      `deep-object-diff`, `typescript`; pin exact majors and report any that differ from the
      spec's assumptions.
- [x] **Finding:** `typescript@7` is the latest but unsupported by `typescript-eslint`; pinned
      to `~5.9` for now. Recorded in [ROADMAP](../ROADMAP.md#pre-flight--pin-versions-do-first).

## Verification gate

- [x] `pnpm install && pnpm -r build` passes.
- [x] A plain Node file importing the built `@kit/core` works (proves ESM output is valid).
- [x] `pnpm lint` runs (the ESLint config loads under the pinned toolchain).

> **Status: complete.** The remainder of this guide (Phases 2–8) is not yet started.

## Definition of done for this phase

The scaffold builds green from a clean `pnpm install`, the six packages resolve each other via
`workspace:*`, and no package declares a direct dependency where the spec requires a peer one.

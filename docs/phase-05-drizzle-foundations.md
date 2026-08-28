# Phase 5 — `@kit/drizzle`, part one: foundations

**Goal:** the server-only Drizzle building blocks that the repository (Phase 6) is assembled
from — types, column presets, naming helpers, the query builders, and `computePatch`. No Nest
runtime; everything here must be usable from a plain script.

**Depends on:** Phases 2–4. **Blocks:** Phase 6.
**Open decisions:** **#3 — expand implementation** (relational `with` vs joins, and behaviour at
two levels) governs `buildExpand`. **#2 — `search` + `total`** governs the `PageResult` shape.

## Why this matters

`computePatch` is the heart of the minimal-update story, and it is a **wrapper** around
`deep-object-diff`, not a re-export — the raw library has four behaviours that are wrong for
database rows. Get this phase's diff correct and Phase 7's "update one field of ten touches one
column" gate falls out almost for free.

## Implementation targets

### `types/`
- [ ] `Db<TSchema>`, `Tx`, `DbOrTx`, `TableWithPk`, `PkColumnKey<T>`, `PkValue<T>`,
      `InferSelect<T>`, `InferInsert<T>`, `SearchQuery<T>`, `PageResult<T>`.
      `PkValue` resolves to a scalar for a single-column PK and an object for a composite one.

### `columns/`
- [ ] `id()` (`generatedAlwaysAsIdentity`), `timestamps()` (`timestamptz`), `softDelete()`,
      `version()`, `moneyCents()` (**bigint, never `numeric`**).

### `naming/`
- [ ] `idx()`, `uq()`, `fk()`, `chk()` — enforce the `idx_` / `uq_` / `fk_` / `chk_` prefixes.

### `diff/` — `computePatch`
The wrapper must correct all four raw behaviours:
- [ ] **Arrays are atomic** — a `jsonb`/Postgres array column is replaced whole, never
      element-diffed into sparse `{ 0: 'x' }`.
- [ ] **`Date` normalised** to ISO string before comparing, so equal timestamps do not look
      changed every request.
- [ ] **Omitted vs `null`** — omitted keys are dropped (PATCH "leave alone"); explicit `null`
      is preserved as a change to set null (`treatNullAsDelete` off by default).
- [ ] **`ignoreKeys`** — strip `id`, `createdAt`, `updatedAt`, `version` before diffing.
- [ ] Default to **shallow**; deep diffing is opt-in per column via `deepKeys` (only sensible
      for `jsonb`). Expose `DiffOptions` and return `PatchResult<T>` = `{ patch, changedKeys, noop }`.

### `query/`
- [ ] `buildWhere(filter, table, allowlist)`, `applySort`, `applyCursor`.
- [ ] `buildExpand(expandTree)` → Drizzle `with`; `relationExists()` for filtering parents by a
      child's column. (Implementation shaped by decision #3.)

## Verification gate

- [ ] `computePatch` has **explicit tests for every wrapper behaviour**: atomic arrays, `Date`
      normalisation, omitted-vs-null, and ignored meta keys.

## Notes and pitfalls

- Do **not** re-export `deep-object-diff`. It is wrapped for the four reasons above.
- Deep-diffing a flat row wastes work and invites the sparse-array bug — keep `deepKeys` opt-in.
- `moneyCents()` is `bigint`; pairing it with `numeric` reintroduces float rounding.
- **Entity schemas are drizzle-zod's job, not the kit's.** Once a project defines its Drizzle
  table with the column presets here, it derives create/update/select Zod schemas with
  `drizzle-zod` (`createInsertSchema`/`createUpdateSchema`/`createSelectSchema`) and `.omit()`s
  the meta columns. The kit does not generate or hold those schemas.

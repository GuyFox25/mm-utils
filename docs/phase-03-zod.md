# Phase 3 — `@kit/zod`

**Goal:** the Zod primitives and, most importantly, the **filter / expand / query DSL builders**
that turn allow-lists into schemas. This is the security-critical phase: an unrestricted filter
is mass assignment plus a DoS via arbitrary nesting; an unrestricted `expand` is a data-exposure
and N+1 vector.

**Depends on:** Phase 2 (`@kit/core`). **Blocks:** Phases 4–8.
**Open decision:** **#5 — Zod version.** Confirm the pinned major (`zod@4`) and that
`buildFilterSchema` expresses cleanly on it *before* writing the builders.

## Why this matters

Callers send filters, expansion, and sorting as query parameters. If any of those map onto an
ORM's native `where` shape, you are welded permanently to one ORM and exposed to whatever the
caller invents. The DSL here is the wire contract: everything is an **allow-list**, and anything
unlisted is rejected with `400` naming the offending parameter.

## Implementation targets

### `primitives/`
- [ ] The opinionated few that zod core does not give you: `zMoneyCents`, `zSlug`,
      `zEnumFrom`, `zTrimmed`.
- [ ] **Do not wrap what zod v4 already ships.** Use `z.uuid()`, `z.email()`, `z.url()`,
      `z.iso.date()`, `z.iso.datetime()`, `z.int().positive()`, `z.string().min(1)` directly.

### `coerce/`
- [ ] `zCsvArray` — comma-separated lists (`active,pending` → `['active','pending']`), which
      zod has no built-in for. Booleans use `z.stringbool()`; numbers use `z.coerce.number()`.
      Coerce **explicitly**, never guess.

### `helpers/`
- [ ] `atLeastOneOf` (a `.refine` that requires one of a set of keys). `makePartialExcept` and
      `dateRange` are one-liners over zod's `.partial()` / `.refine()` — inline them where used
      rather than exporting.
- [ ] **No `stripMetaColumns`.** Entity create/update/select schemas are generated from the
      Drizzle table with **drizzle-zod** (`createInsertSchema(table).omit({ id: true,
      createdAt: true, updatedAt: true, version: true })`), which lives at the `@kit/drizzle`
      layer. This package stays browser-safe and owns only the *query* DSL, not entity shapes.

### The DSL — the core of this phase
- [ ] `filter/` — `FilterNode`, `FilterOperator`, `buildFilterSchema({ fields, relations, maxDepth })`.
      Fields map to allowed operators (`status: ['eq','in']`); relations nest with their own
      field maps; `maxDepth` caps nesting.
- [ ] `expand/` — `ExpandTree`, `buildExpandSchema({ allowed, maxDepth })`. `allowed` is an
      explicit list of dotted paths (`['lines', 'lines.product']`).
- [ ] `query/` — `buildQuerySchema({ filter, expand, sort, limit })` composing all of the above,
      plus `sort` (allow-list + default) and `limit` (default + max).
- [ ] `pagination/` — `cursorPageSchema`, `offsetPageSchema`, `sortSchema(allowed)`.
- [ ] `errors/` — `formatZodIssues`, producing one stable API error shape.

## Verification gate

A single test file must prove all three rejections, each with a message **naming the offender**:
- [ ] An **unlisted filter field** is rejected.
- [ ] An **unlisted expand path** is rejected.
- [ ] A filter nested **past `maxDepth`** is rejected.

Plus:
- [ ] Coercion is explicit and typed (a `limit` string becomes a number via schema, not a guess).

## Notes and pitfalls

- Never accept an arbitrary filter object, and never let Drizzle's `where` shape become the wire
  format.
- `sort` uses a `-` prefix for descending and is comma-separated; `expand` is comma-separated
  dotted paths. Both are validated against their allow-lists here, before they ever reach a query.

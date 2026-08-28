# Phase 2 — `@kit/core`

**Goal:** the zero-dependency foundation every other package builds on — types, `Result`, the
error hierarchy, guards, and pure utilities. If it has a runtime dependency, it does not belong
here.

**Depends on:** Phase 1. **Blocks:** Phases 3–8.
**Open decisions:** none.

## Why this matters

`@kit/core` is imported by browser bundles and Node services alike, so it must stay free of any
runtime dependency. It is also where the `AppError` hierarchy lives — services throw these, not
`HttpException`, which is what keeps business logic testable without Nest and portable if a
service ever moves off HTTP.

## Implementation targets

### `types/`
- [ ] `Brand`, `Prettify`, `DeepPartial`, `RequireAtLeastOne`, `ValueOf`, `Entries`.
- [ ] `UniqueTuple<T>`, `HasDuplicates<T>` — compile-time duplicate detection (used by
      `stripMetaColumns` in Phase 3).
- [ ] `NonEmptyArray<T>`, `Nullish`, `Defined`.

### `result/`
- [ ] `Result<T, E>`, `ok`, `err`, `isOk`, `isErr`.
- [ ] `map`, `mapErr`, `andThen`, `unwrap`, `unwrapOr`.
- [ ] `tryCatch`, `tryCatchAsync`.

### `errors/`
- [ ] `AppError` (abstract; carries `code` + `httpStatus`).
- [ ] `NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`,
      `UnauthorizedError`, `RateLimitError`.
- [ ] `toErrorEnvelope`, `isAppError`.

### `guards/`
- [ ] `isDefined`, `isNonEmptyString`, `isPlainObject`, `invariant`, `assertNever`.

### Utilities
- [ ] `array/` — `chunk`, `groupBy`, `keyBy`, `partition`, `unique`, `uniqueBy`, `sortBy`,
      `difference`, `intersection`, `zip`, `toMap`.
- [ ] `object/` — `pick`, `omit`, `mapValues`, `filterValues`, `compact`, `deepFreeze`,
      `deepMerge`.
- [ ] `string/` — `slugify`, `truncate`, `capitalize`, `camelToSnake`, `snakeToCamel`,
      `maskEmail`, `randomId`, `normalizeWhitespace`.
- [ ] `number/` — `clamp`, `round`, `sum`, `average`, `percentage`, and money helpers
      `toCents`, `fromCents`, `formatMoney`. **Money is always integer cents, never a float.**
- [ ] `date/` — `startOfDay`, `endOfDay`, `addDays`, `diffInDays`, `isBetween`, `toIsoDate`.
- [ ] `async/` — `sleep`, `retry`, `withTimeout`, `pMap` (bounded concurrency), `debounce`,
      `throttle`, `memoizeAsync`.

## Verification gate

- [ ] Every public export has a test (aim for 100% of the surface).
- [ ] `pnpm why` (or `pnpm list --prod`) shows **zero runtime dependencies**.
- [ ] Every public export carries a TSDoc comment with at least one example.

## Notes and pitfalls

- `assertNever` must take `never` and throw — it is the exhaustiveness backstop for switches.
- The money helpers exist so no one is tempted to store currency as a float. Keep them in
  `number/` and reuse `zMoneyCents` (Phase 3) and `moneyCents()` (Phase 5) around them.

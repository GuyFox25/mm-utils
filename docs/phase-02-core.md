# Phase 2 — `@kit/core`

**Goal:** the zero-dependency foundation every other package builds on — the error hierarchy,
money-cents helpers, a couple of assertion guards, and the handful of type helpers the kit
itself needs. Nothing a well-known library already does.

**Depends on:** Phase 1. **Blocks:** Phases 3–8.
**Open decisions:** none.

## Why this matters

`@kit/core` is imported by browser bundles and Node services alike, so it must stay free of any
runtime dependency. It is also where the `AppError` hierarchy lives — services throw these, not
`HttpException`, which is what keeps business logic testable without Nest and portable if a
service ever moves off HTTP.

## Implementation targets

### `errors/`
- [ ] `AppError` (abstract; carries `code` + `httpStatus`).
- [ ] `NotFoundError`, `ConflictError`, `ValidationError`, `ForbiddenError`,
      `UnauthorizedError`, `RateLimitError`.
- [ ] `toErrorEnvelope`, `isAppError`.

### `money/`
- [ ] `toCents`, `fromCents`, `formatMoney`. **Money is always integer cents, never a float.**

### `guards/`
- [ ] `invariant` (assert a condition, narrowing the type) and `assertNever` (exhaustiveness
      backstop). Everything else — `isPlainObject`, `isNil`, `isEmpty` — comes from lodash-es.

### `types/`
- [ ] `Brand` and `NonEmptyArray` — the only two the kit itself needs. Reach for `type-fest`
      for `Prettify`, `DeepPartial`, `RequireAtLeastOne`, `ValueOf`, `Entries` and the rest.
      (`UniqueTuple`/`HasDuplicates` are not needed: their sole consumer, `stripMetaColumns`,
      is replaced by drizzle-zod's `.omit()`.)

## Not in this package — use a library

| Was going to be here | Use instead |
|---|---|
| `Result` monad (`ok`/`err`/`andThen`/`tryCatch`) | **neverthrow**, or just throw `AppError` |
| `array/` (`chunk`, `groupBy`, `keyBy`, `uniqueBy`, `sortBy`, `zip`, …) | **lodash-es** |
| `object/` (`pick`, `omit`, `mapValues`, `deepMerge`, …) | **lodash-es** |
| `string/` (`capitalize`, `truncate`, `camelCase`/`snakeCase`, `slugify`) | **lodash-es** (+ a slug lib if needed) |
| `randomId` | **nanoid** / **uuid** |
| `number/` non-money (`clamp`, `round`, `sum`, `mean`) | **lodash-es** |
| `date/` (`startOfDay`, `addDays`, `differenceInDays`, `isWithinInterval`) | **date-fns** |
| `async/` (`retry`, `withTimeout`, `pMap`, `debounce`, `throttle`) | **p-retry**, **p-timeout**, **p-map**, **lodash-es** |

## Verification gate

- [ ] Every public export has a test (aim for 100% of the surface).
- [ ] `pnpm why` (or `pnpm list --prod`) shows **zero runtime dependencies**.
- [ ] Every public export carries a TSDoc comment with at least one example.

## Notes and pitfalls

- `assertNever` must take `never` and throw — it is the exhaustiveness backstop for switches.
- The money helpers exist so no one is tempted to store currency as a float. Keep them in
  `money/` and reuse `zMoneyCents` (Phase 3) and `moneyCents()` (Phase 5) around them.

# Phase 2 — `@kit/core`

**Goal:** the zero-dependency foundation every other package builds on — the error hierarchy
and a couple of assertion guards. Nothing a well-known library already does.

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

### `guards/`

- [ ] `invariant` (assert a condition, narrowing the type) and `assertNever` (exhaustiveness
      backstop). Everything else — `isPlainObject`, `isNil`, `isEmpty` — comes from lodash-es.

## Not in this package — use a library

| Was going to be here                                                      | Use instead                                          |
| ------------------------------------------------------------------------- | ---------------------------------------------------- |
| `Result` monad (`ok`/`err`/`andThen`/`tryCatch`)                          | **neverthrow**, or just throw `AppError`             |
| `array/` (`chunk`, `groupBy`, `keyBy`, `uniqueBy`, `sortBy`, `zip`, …)    | **lodash-es**                                        |
| `object/` (`pick`, `omit`, `mapValues`, `deepMerge`, …)                   | **lodash-es**                                        |
| `string/` (`capitalize`, `truncate`, `camelCase`/`snakeCase`, `slugify`)  | **lodash-es** (+ a slug lib if needed)               |
| `randomId`                                                                | **nanoid** / **uuid**                                |
| `number/` (`clamp`, `round`, `sum`, `mean`)                               | **lodash-es**                                        |
| `money/` (`toCents`, `formatMoney`)                                       | project `utils/` — cents/currency is app policy      |
| `date/` (`startOfDay`, `addDays`, `differenceInDays`, `isWithinInterval`) | **date-fns**                                         |
| `async/` (`retry`, `withTimeout`, `pMap`, `debounce`, `throttle`)         | **p-retry**, **p-timeout**, **p-map**, **lodash-es** |
| type helpers (`Brand`, `Prettify`, `DeepPartial`, `NonEmptyArray`, …)     | **type-fest** (add a local one only when the kit needs it) |

## Verification gate

- [ ] Every public export has a test (aim for 100% of the surface).
- [ ] `pnpm why` (or `pnpm list --prod`) shows **zero runtime dependencies**.
- [ ] Every public export carries a TSDoc comment with at least one example.

## Notes and pitfalls

- `assertNever` must take `never` and throw — it is the exhaustiveness backstop for switches.
- Keep everything here domain-agnostic and dependency-free. Anything opinionated about a
  domain (money, currency, units) belongs in a project's own `utils/`, not here.

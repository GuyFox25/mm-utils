# Phase 7 — `@kit/nest`

**Goal:** the NestJS wiring that turns the repository into a running service — `BaseCrudService`
(the transactional read-diff-write flow), the controller factory, and the right extension slot
for each concern. This is where the minimal-update guarantee becomes observable over HTTP.

**Depends on:** Phases 2–6. **Blocks:** Phase 8.
**Open decision:** **#4 — `Ctx` shape.** Explicit parameter (more testable) vs ambient via
`AsyncLocalStorage` alongside the transaction (less noisy). Decide before writing the service.

## Why this matters

Nest has four extension slots and "middleware" is rarely the right one. Putting each concern in
the correct slot is the whole point of this package:

| Concern | Mechanism |
|---|---|
| Auth / authorisation | **Guard** — your own, via `@nestjs/passport` strategies |
| Validation, query parsing, coercion | **Pipe** — `nestjs-zod` for bodies, `QueryParsePipe` for the DSL |
| Error shaping | **Exception filter** |
| Transactions, no-op detection | **Interceptor** (wraps the handler) |
| CORS, body parsing, correlation ids | **Middleware** (before everything, cannot see handler) |

Runtime order: `middleware → guards → interceptors(pre) → pipes → handler → interceptors(post)
→ exception filters`.

## The service flow (the crux)

`BaseCrudService.update()` does **not** write what the caller sent. It:
- [ ] Opens a transaction.
- [ ] Calls `repo.getById(pk, { tx })` **inside the same transaction** (no TOCTOU gap).
- [ ] Computes `patch = computePatch(current, input, this.diffOptions())`.
- [ ] If the patch is empty, returns `{ row: current, changedKeys: [], noop: true }` — **no UPDATE**.
- [ ] Otherwise calls `repo.update(pk, patch, { expectedVersion: current.version, tx })`.

Reading the current row yields `version` for free, so optimistic locking costs nothing extra.
`getById` at the service layer throws `NotFoundError` rather than returning `null`.

## Implementation targets

### `service/`
- [ ] `BaseCrudService` with the five operations and the flow above.
- [ ] Override points: `assertCanRead`, `assertCanWrite`, `beforeCreate`, `beforeUpdate`,
      `afterChange`, `diffOptions`. (Invariants like stamping `updatedBy` — **not** workflow.)
- [ ] `createCrudController({ path, only, …schemas, guards })` — a **factory**, not an abstract
      class, because Nest reads route decorators off the concrete class at registration. Always
      pass an explicit `only: [...]`; do not generate routes nobody asked for.

### `db/`, `pipes/`, `decorators/`
- [ ] `DbModule.forRoot/forRootAsync`, `DB` injection symbol, `@InjectDb()`.
- [ ] `QueryParsePipe` (parse + allow-list validate the filter/expand/sort DSL), `ParsePkPipe`.
      Body validation is `nestjs-zod`'s `ZodValidationPipe` — do not hand-roll one.
- [ ] `@ListQuery(schema)`, `@DetailQuery(schema)` — the two decorators that compose parse +
      validate for the query DSL. `@Public()`/`@CurrentUser()`/`@Roles()` belong with your
      auth setup (`@nestjs/passport`), not here.

### `filters/`, `interceptors/`
- [ ] `AppErrorFilter` (AppError → HTTP), `PostgresExceptionFilter` (pg-error → 409/422/500).
      Zod errors are shaped by `nestjs-zod`'s filter; a last-resort `AllExceptionsFilter` is
      Nest's built-in behaviour.
- [ ] `TransactionInterceptor` (opens tx, binds via ALS), `NoopUpdateInterceptor` (304 on empty
      diff, configurable to 200; bound per-controller, not global).

### `bootstrap/`
- [ ] `createApp()` — registers `AppErrorFilter` + `PostgresExceptionFilter` so every service
      starts identically. Config is `@nestjs/config` (with a Zod `validate`); health is
      `@nestjs/terminus`.

### `examples/`
- [ ] An example app exposing a full CRUD resource, for the gate.

## Not in this package — use a library

| Was going to be here | Use instead |
|---|---|
| `createConfigModule(envSchema)` | **`@nestjs/config`** `forRoot({ validate })` with a Zod parse |
| `/health`, `/ready` | **`@nestjs/terminus`** (`HealthModule`, `TypeOrmHealthIndicator`/custom DB ping) |
| `JwtAuthGuard`, `RolesGuard`, `ApiKeyGuard`, `OwnershipGuard` | **`@nestjs/passport`** + strategies — these are app-specific, not domain-agnostic |
| `ZodValidationPipe`, `ZodExceptionFilter` | **nestjs-zod** (pipe + filter + OpenAPI in one) |
| `LoggingInterceptor` | **nestjs-pino** |
| `TimeoutInterceptor` | the one-liner from the Nest docs, dropped in per app |
| `EnvelopeInterceptor`, `ParseCursorPipe`, `@Transactional()`, `@ApiPaginated()` | fold into the contract/`@ListQuery` layer or inline — not worth their own exports |

## Verification gate

- [ ] The example app exposes a full CRUD resource.
- [ ] An update sending **one changed field of ten** issues an UPDATE touching **exactly that
      field**.
- [ ] An update sending **no changes** issues **no UPDATE at all** and reports `noop: true`.

## Notes and pitfalls

- **Do not move the diff into an interceptor or middleware.** An interceptor would need a
  route→service registry that breaks the moment someone adds a nested resource. The service owns
  the diff; the interceptor only stops the response when `noop` is true.
- Generated CRUD routes are a starting point for internal services, not a public API.
- Business rules do not go in `beforeUpdate`/`afterChange`.

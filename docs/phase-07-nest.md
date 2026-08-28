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
| Auth / authorisation | **Guard** (before pipes, sees route metadata) |
| Validation, query parsing, coercion | **Pipe** (one argument, after guards, schema-driven) |
| Error shaping | **Exception filter** |
| Transactions, logging, timing, no-op detection | **Interceptor** (wraps the handler) |
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
- [ ] `ZodValidationPipe`, `QueryParsePipe` (parse + allow-list validate), `ParsePkPipe`,
      `ParseCursorPipe`.
- [ ] `@ListQuery(schema)`, `@DetailQuery(schema)`, `@Public()`, `@CurrentUser()`, `@Roles()`,
      `@Transactional()`, `@ApiPaginated()`.

### `guards/`, `filters/`, `interceptors/`
- [ ] `JwtAuthGuard`, `RolesGuard`, `ApiKeyGuard`, `OwnershipGuard`.
- [ ] `AppErrorFilter` (AppError → HTTP), `PostgresExceptionFilter` (pg-error → 409/422/500),
      `ZodExceptionFilter` (→ 400), `AllExceptionsFilter` (last resort).
- [ ] `TransactionInterceptor` (opens tx, binds via ALS), `NoopUpdateInterceptor` (304 on empty
      diff, configurable to 200; emits audit event with `changedKeys: []`; bound per-controller,
      not global), `LoggingInterceptor`, `TimeoutInterceptor`, `EnvelopeInterceptor`.

### `config/`, `health/`, `bootstrap/`
- [ ] `createConfigModule(envSchema)` — Zod-validated env, fails at boot.
- [ ] `/health` and `/ready` with a DB ping.
- [ ] `createApp()` — applies the standard stack so every service starts identically.

### `examples/`
- [ ] An example app exposing a full CRUD resource, for the gate.

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

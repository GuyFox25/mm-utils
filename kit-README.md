# @kit — shared platform toolkit

A set of layered packages holding the code that keeps getting rewritten across our
TypeScript backends: generic Drizzle repositories, NestJS base services, and the
cross-cutting concerns every service needs on day one.

> Replace the `@kit` scope with your real npm scope before publishing.

---

## For Claude Code — read this first

**This file is the specification. Enter plan mode and produce a plan before writing any
code.**

Your plan must:

1. Restate the package graph and confirm the dependency direction rule.
2. List the phases you will build in, with the verification gate for each (see
   **Build plan** below).
3. Surface every assumption you are making, and every ambiguity you found in this
   document, as explicit questions — see **Open decisions** at the end for the ones I
   already know about. Do not silently choose for me.
4. Name the exact versions you intend to pin. **Do not trust versions from memory** —
   run `pnpm view <pkg> version` for `drizzle-orm`, `zod`, `@nestjs/common`,
   `deep-object-diff` and `typescript`, and report what you find. If a major differs
   from what this document assumes, say so before proceeding.

Do not begin implementation until I approve the plan. When you do implement, complete
one phase and verify it before starting the next — do not scaffold everything and then
debug.

---

## What this is

Everything here is **domain-agnostic**. It knows about tables, primary keys, cursors,
transactions, diffs and HTTP status codes. It knows nothing about orders, users, cards
or matches.

## What this is not

This is **not** a project's own `utils` package. Each project keeps one of those:

| Lives in `@kit/*` (this repo) | Lives in each project's `utils/` |
|---|---|
| `BaseCrudRepository`, `BaseCrudService` | Concrete repositories and services |
| Column presets (`id()`, `timestamps()`) | The actual Drizzle table definitions |
| Zod primitives, filter/expand DSL builders | Domain Zod schemas and inferred types |
| `PostgresExceptionFilter`, `ZodValidationPipe` | Domain-specific guards and policies |
| Diff, pagination and cursor machinery | API contracts between your services |

**The promotion rule:** nothing enters this library until it has been written a third
time. Two occurrences is a coincidence; three is a pattern.

---

## Layering

The critical constraint: **`client` packages import from this too.** A React bundle must
never pull in NestJS or `pg`. So this is several packages, not one, and dependencies
point strictly downward.

```
@kit/core        zero runtime dependencies             ← safe in browsers
    ↑
@kit/zod         peer: zod                             ← safe in browsers
    ↑
@kit/http        peer: zod, @ts-rest/core              ← safe in browsers
    ↑
@kit/drizzle     peer: drizzle-orm, pg, deep-object-diff  ← server only
    ↑
@kit/nest        peer: @nestjs/common, @nestjs/core    ← server only
    ↑
@kit/testing     peer: vitest                          ← dev only
```

Every cross-package dependency is a **peer dependency**, never a direct one.

---

## Repository layout

```
kit/
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .changeset/
└── packages/
    ├── core/  zod/  http/  drizzle/  nest/  testing/
```

---

## The five-method contract

Both abstract classes expose exactly five public operations. Everything else is
protected or internal.

```
create · update · delete · search · getById
```

### BaseCrudRepository

Speaks SQL. Framework-free — usable from a script, a worker or a test with no Nest
runtime.

```ts
export abstract class BaseCrudRepository<TTable extends TableWithPk, TSchema = Empty> {
  protected abstract readonly table: TTable;

  constructor(protected readonly db: Db<TSchema>) {}

  getById(
    pk: PkValue<TTable>,
    opts?: { expand?: ExpandTree; includeDeleted?: boolean; tx?: DbOrTx },
  ): Promise<InferSelect<TTable> | null>;

  search(
    query: SearchQuery<TTable>,   // filter, sort, expand, limit, cursor
    opts?: { includeDeleted?: boolean; tx?: DbOrTx },
  ): Promise<PageResult<InferSelect<TTable>>>;   // { items, nextCursor, total? }

  create(values: InferInsert<TTable>, tx?: DbOrTx): Promise<InferSelect<TTable>>;

  update(
    pk: PkValue<TTable>,
    patch: Partial<InferInsert<TTable>>,          // already-diffed patch
    opts?: { expectedVersion?: number; tx?: DbOrTx },
  ): Promise<InferSelect<TTable>>;

  delete(
    pk: PkValue<TTable>,
    opts?: { hard?: boolean; tx?: DbOrTx },
  ): Promise<void>;

  // internal primitives — protected, not part of the public surface
  protected exists(pk, tx?): Promise<boolean>;
  protected count(filter?, tx?): Promise<number>;
  protected transaction<T>(fn: (tx: Tx) => Promise<T>): Promise<T>;
  protected buildWhere(filter?: FilterNode): SQL | undefined;
  protected defaultSort(): SortSpec;
  protected softDeleteFilter(): SQL | undefined;
}
```

Behavioural contract:

- Every method takes an optional `tx`. Pass one and the call joins your transaction;
  omit it and it runs on the base connection. That is what `DbOrTx` buys.
- `update` receives an **already-minimised patch**. The repository does not diff — the
  service does. The repository writes exactly what it is given.
- `update` with `expectedVersion` performs optimistic locking, incrementing via
  ``sql`${table.version} + 1` `` and throwing `ConflictError` when zero rows match.
- Soft-deleted rows are excluded from `getById` and `search` unless
  `includeDeleted: true`.
- Composite primary keys are supported. `PkValue<TTable>` resolves to a scalar for a
  single-column PK, an object for a composite one.
- `search` returns `{ items, nextCursor }`. Cursors encode the sort key plus the PK as a
  tiebreak, so pagination is stable under concurrent inserts.

### BaseCrudService

Speaks HTTP semantics and business rules. Throws `AppError` subclasses from
`@kit/core`, never `HttpException` — that keeps services testable without Nest and
portable if one ever moves off HTTP.

```ts
export abstract class BaseCrudService<TTable extends TableWithPk> {
  constructor(protected readonly repo: BaseCrudRepository<TTable>) {}

  getById(pk, query?: { expand?: ExpandTree }, ctx?: Ctx): Promise<InferSelect<TTable>>;
  search(query: SearchQuery<TTable>, ctx?: Ctx): Promise<PageResult<InferSelect<TTable>>>;
  create(input: InferInsert<TTable>, ctx?: Ctx): Promise<InferSelect<TTable>>;
  update(pk, input: Partial<InferInsert<TTable>>, ctx?: Ctx): Promise<UpdateResult<...>>;
  delete(pk, opts?: { hard?: boolean }, ctx?: Ctx): Promise<void>;

  // override points
  protected assertCanRead(row, ctx): Promise<void>;
  protected assertCanWrite(row, ctx): Promise<void>;
  protected beforeCreate(input, ctx): Promise<InferInsert<TTable>>;
  protected beforeUpdate(patch, current, ctx): Promise<Partial<InferInsert<TTable>>>;
  protected afterChange(row, changedKeys, ctx): Promise<void>;

  protected diffOptions(): DiffOptions;   // per-entity tuning, see below
}
```

`getById` throws `NotFoundError` rather than returning null — that is the difference
between the two layers.

---

## Minimal updates via diff

`BaseCrudService.update()` does not write what the caller sent. It:

1. Opens a transaction.
2. Calls `repo.getById(pk, { tx })` — **inside the same transaction**, so there is no
   time-of-check/time-of-use gap between reading and writing.
3. Computes `patch = computePatch(current, input, this.diffOptions())`.
4. If `patch` is empty, returns `{ row: current, changedKeys: [], noop: true }` without
   issuing an UPDATE at all.
5. Otherwise calls `repo.update(pk, patch, { expectedVersion: current.version, tx })`.

Reading the current row gives us `version` for free, so optimistic locking costs nothing
extra.

### computePatch — `@kit/drizzle/diff`

A wrapper around `deep-object-diff`, not a re-export. The raw library has four
behaviours that are wrong for database rows, and the wrapper exists to correct them:

| Raw behaviour | Why it is wrong here | What the wrapper does |
|---|---|---|
| Diffs arrays element-by-element, producing sparse objects like `{ 0: 'x' }` | A Postgres array or `jsonb` array column is written whole; a sparse index map is not a valid value | Treats arrays as **atomic** — changed or not, never partially |
| `Date` instances compare by reference in some paths | Two equal timestamps would look changed on every request | Normalises `Date` to ISO string before comparing |
| Cannot distinguish "key omitted" from `undefined` | In PATCH semantics, omitted means *leave alone* and `null` means *set null* | Omitted keys are dropped; explicit `null` is preserved as a change |
| Diffs every key it is given | `id`, `createdAt`, `updatedAt`, `version` must never come from a caller | Strips a configurable `ignoreKeys` set before diffing |

```ts
export interface DiffOptions {
  ignoreKeys?: string[];        // default: ['id', 'createdAt', 'updatedAt', 'version']
  atomicKeys?: string[];        // always replace whole, never deep-diff (jsonb columns)
  deepKeys?: string[];          // opt in to deep diffing for specific jsonb columns
  treatNullAsDelete?: boolean;  // default false
}

export interface PatchResult<T> {
  patch: Partial<T>;
  changedKeys: (keyof T)[];
  noop: boolean;
}

export const computePatch = <T extends object>(
  current: T,
  incoming: Partial<T>,
  opts?: DiffOptions,
): PatchResult<T>;
```

**Default to shallow.** Deep diffing is opt-in per column via `deepKeys`, because deep
diff only makes sense for `jsonb`. Deep-diffing a flat row wastes work and invites the
array bug above.

### The no-op interceptor — `@kit/nest`

The service already skips the write when nothing changed. The interceptor exists for the
one thing the service cannot do: stop the response before it is built.

`NoopUpdateInterceptor` inspects an `UpdateResult` and, when `noop` is true, returns
`304 Not Modified` (or `200` with the unchanged row — configurable) and emits an audit
event with `changedKeys: []`. Bind it per-controller; it is not global by default.

**Do not move the diff itself into an interceptor.** An interceptor would have to know
which service to call for each route, which means a route→service registry that breaks
the moment someone adds a nested resource.

---

## Query parameter parsing

Callers send filters, expansion and sorting as query parameters. Parsing them is a
**pipe**, not middleware — it transforms one argument against a schema and runs after
guards, which is exactly what pipes are for. Middleware would have to mutate `req.query`
with no schema and no types.

### Wire syntax

Bracket form is primary. It maps directly onto the nested filter DSL and is unambiguous:

```
GET /orders
  ?filter[status][in]=active,pending
  &filter[createdAt][gte]=2026-01-01
  &filter[lines][qty][gt]=0
  &expand=lines,lines.product
  &sort=-createdAt,id
  &limit=20
  &cursor=eyJrIjoi...
```

A compact form is also accepted where nesting is not needed: `?status=in:active,pending`.

- `sort`: comma-separated, `-` prefix for descending.
- `expand`: comma-separated dotted paths.
- Values are coerced by the target field's Zod schema, not guessed — `limit=20` becomes
  a number because the schema says so, not because it looks numeric.

### The pipe and the decorator

```ts
// pipe
new QueryParsePipe({ filter: orderFilterSchema, expand: orderExpandSchema, maxLimit: 100 })

// param decorator — the intended DX
@Get()
search(@ListQuery(orderQuerySchema) query: SearchQuery<typeof orders>) {
  return this.service.search(query);
}

@Get(':id')
getById(
  @Param('id', ParsePkPipe) id: number,
  @DetailQuery(orderExpandSchema) query: { expand?: ExpandTree },
) {
  return this.service.getById(id, query);
}
```

`@ListQuery` and `@DetailQuery` compose parse + validate + type in one place, so a
controller never touches a raw query object.

### Both filter and expand are allow-lists

This is the part that matters most. An unrestricted filter is mass assignment plus a
denial-of-service vector through arbitrarily deep nesting. An unrestricted `expand` is a
data-exposure and N+1 vector — a caller could expand `user.paymentMethods` from an
unrelated endpoint.

```ts
export const orderQuerySchema = buildQuerySchema({
  filter: {
    fields: { status: ['eq', 'in'], createdAt: ['gte', 'lte'], total: ['gt', 'lt'] },
    relations: { lines: { fields: { qty: ['gt'] } } },
    maxDepth: 2,
  },
  expand: {
    allowed: ['lines', 'lines.product', 'customer'],
    maxDepth: 2,
  },
  sort: { allowed: ['createdAt', 'total', 'id'], default: '-createdAt' },
  limit: { default: 20, max: 100 },
});
```

Anything not listed is rejected with `400`, naming the offending parameter. Never accept
an arbitrary filter object, and never let an ORM's native `where` shape become the wire
format — that welds you permanently to one ORM.

---

## Package contents

### @kit/core — zero dependencies

```
core/src/
├── types/       Brand, Prettify, DeepPartial, RequireAtLeastOne, ValueOf, Entries,
│                UniqueTuple<T>, HasDuplicates<T>, NonEmptyArray<T>, Nullish, Defined
├── result/      Result<T,E>, ok, err, isOk, isErr, map, mapErr, andThen,
│                unwrap, unwrapOr, tryCatch, tryCatchAsync
├── errors/      AppError (abstract, carries `code` + `httpStatus`), NotFoundError,
│                ConflictError, ValidationError, ForbiddenError, UnauthorizedError,
│                RateLimitError, toErrorEnvelope, isAppError
├── guards/      isDefined, isNonEmptyString, isPlainObject, invariant, assertNever
├── array/       chunk, groupBy, keyBy, partition, unique, uniqueBy, sortBy,
│                difference, intersection, zip, toMap
├── object/      pick, omit, mapValues, filterValues, compact, deepFreeze, deepMerge
├── string/      slugify, truncate, capitalize, camelToSnake, snakeToCamel,
│                maskEmail, randomId, normalizeWhitespace
├── number/      clamp, round, sum, average, percentage · toCents, fromCents,
│                formatMoney — money is ALWAYS integer cents, never a float
├── date/        startOfDay, endOfDay, addDays, diffInDays, isBetween, toIsoDate
└── async/       sleep, retry, withTimeout, pMap (bounded concurrency),
                 debounce, throttle, memoizeAsync
```

### @kit/zod — peer: zod

```
zod/src/
├── primitives/  zUuid, zIntId, zEmail, zPhone, zSlug, zUrl, zIsoDate, zTimestamptz,
│                zPositiveInt, zMoneyCents, zNonEmptyString, zEnumFrom, zTrimmed
├── coerce/      zBooleanQuery, zNumberQuery, zCsvArray — query strings arrive as
│                strings; coerce explicitly, never guess
├── helpers/     stripMetaColumns (compile-time duplicate-key detection via
│                UniqueTuple), makePartialExcept, atLeastOneOf, dateRange
├── filter/      FilterNode, FilterOperator, buildFilterSchema(...)
├── expand/      ExpandTree, buildExpandSchema({ allowed, maxDepth })
├── query/       buildQuerySchema({ filter, expand, sort, limit }) — composes the above
├── pagination/  cursorPageSchema, offsetPageSchema, sortSchema(allowed)
└── errors/      formatZodIssues — one stable API error shape
```

### @kit/http — peer: zod, @ts-rest/core

```
http/src/
├── envelope/    ok(), fail(), PaginatedResponse<T>, ErrorEnvelope, UpdateResult<T>
├── cursor/      encodeCursor, decodeCursor (base64 of sort key + tiebreak PK)
├── qs/          parseBracketQuery, parseCompactQuery — pure string→object parsing,
│                shared by the server pipe and any typed client
├── contracts/   paginatedResponse(schema), standardErrors, listQueryParams
├── client/      createTypedClient, interceptors (bearerAuth, retryOn5xx,
│                timeout, correlationId)
└── status/      HTTP_STATUS, isRetryable(status)
```

### @kit/drizzle — peer: drizzle-orm, pg, deep-object-diff

```
drizzle/src/
├── types/       Db<TSchema>, Tx, DbOrTx, TableWithPk, PkColumnKey<T>, PkValue<T>,
│                InferSelect<T>, InferInsert<T>, SearchQuery<T>, PageResult<T>
├── columns/     id() (generatedAlwaysAsIdentity), timestamps() (timestamptz),
│                softDelete(), version(), moneyCents() (bigint, never numeric)
├── naming/      idx(), uq(), fk(), chk() — enforce the prefix conventions
├── repository/  base-crud.repository.ts, pk.ts (composite PK via getTableConfig)
├── diff/        computePatch, DiffOptions, PatchResult — the deep-object-diff wrapper
├── query/       buildWhere(filter, table, allowlist), applySort, applyCursor,
│                buildExpand(expandTree) → Drizzle `with`, relationExists() for
│                filtering parents by a child's column
├── writes/      syncChildren(tx, childTable, parentKey, rows) — bulk delete +
│                insert…onConflictDoUpdate, constant query count
├── transaction/ withTransaction, TransactionHost (AsyncLocalStorage)
├── search/      trigramSearch(table, column, term, threshold) — pg_trgm
└── seed/        seedTable (onConflictDoNothing), seedInOrder (respects FK ordering)
```

### @kit/nest — peer: @nestjs/common, @nestjs/core

Nest has four extension slots. "Middleware" is rarely the right one:

| Concern | Mechanism | Why |
|---|---|---|
| Authentication / authorisation | **Guard** | Runs before pipes, sees route metadata, returns boolean or throws |
| Validation, query parsing, coercion | **Pipe** | Scoped to one argument, runs after guards, schema-driven |
| Error shaping | **Exception filter** | Catches thrown errors and owns the response |
| Transactions, logging, timing, no-op detection | **Interceptor** | Wraps the handler; sees request and response |
| CORS, body parsing, correlation ids | **Middleware** | Runs before everything; cannot see the handler |

Runtime order: `middleware → guards → interceptors (pre) → pipes → handler →
interceptors (post) → exception filters`.

```
nest/src/
├── db/            DbModule.forRoot/forRootAsync, DB = Symbol('DB_CONNECTION'),
│                  @InjectDb()
├── service/       base-crud.service.ts, base-crud.controller.ts (mixin factory)
├── guards/        JwtAuthGuard, RolesGuard, ApiKeyGuard (B2B), OwnershipGuard
├── pipes/         ZodValidationPipe, QueryParsePipe, ParsePkPipe, ParseCursorPipe
├── decorators/    @ListQuery(schema), @DetailQuery(schema), @Public(),
│                  @CurrentUser(), @Roles(), @Transactional(), @ApiPaginated()
├── filters/       AppErrorFilter (AppError → HTTP), PostgresExceptionFilter
│                  (pg-error-enum → 409/422/500), ZodExceptionFilter (→ 400),
│                  AllExceptionsFilter (last resort, logs, 500)
├── interceptors/  TransactionInterceptor (opens tx, binds via ALS),
│                  NoopUpdateInterceptor (304 on empty diff),
│                  LoggingInterceptor, TimeoutInterceptor, EnvelopeInterceptor
├── config/        createConfigModule(envSchema) — Zod-validated env, fails at boot
├── health/        /health and /ready with a DB ping
└── bootstrap/     createApp() — applies the standard stack so every service starts
                   identically
```

**Why the controller is a factory, not an abstract class:** Nest reads route decorators
off the concrete class at registration, so inherited routes from a generic abstract
controller do not register reliably.

```ts
export class ProductsController extends createCrudController({
  path: 'products',
  only: ['getById', 'search', 'create', 'update'],   // no delete route
  createSchema: createProductSchema,
  updateSchema: updateProductSchema,
  querySchema: productQuerySchema,
  guards: [JwtAuthGuard],
}) {
  constructor(protected readonly service: ProductsService) {
    super(service);
  }
}
```

Pass an explicit `only: [...]`. Do not generate routes nobody asked for.

### @kit/testing — peer: vitest

```
testing/src/
├── factories/   buildFactory<T>(defaults) with per-call overrides
├── db/          withTestDb (each test in a transaction, rolled back), truncateAll
└── nest/        createTestingModule with pre-wired overrides
```

---

## Conventions

- No `any`. Use `unknown` and narrow.
- Explicit return types on every exported function and public method.
- Arrow functions over `function` declarations.
- Blank line before every `return`.
- Every public export has a TSDoc comment with at least one example.
- Every package has an `index.ts` barrel; deep imports into `src/` are unsupported.
- Money is integer cents. Timestamps are `timestamptz`. Index and constraint names use
  the `idx_` / `uq_` / `fk_` / `chk_` prefixes.

---

## Build plan

Complete and verify each phase before starting the next.

**Phase 1 — workspace.** `pnpm-workspace.yaml`, `tsconfig.base.json`, six empty
packages with correct peer dependencies and barrels, changesets configured.
*Gate:* `pnpm install && pnpm -r build` passes; a script importing `@kit/core` from a
plain Node file works.

**Phase 2 — `@kit/core`.** Types, `Result`, `AppError` hierarchy, guards, and the
array/object/string/number/date/async utilities.
*Gate:* 100% of exports have tests; `pnpm why` shows zero runtime dependencies.

**Phase 3 — `@kit/zod`.** Primitives, coercion, `stripMetaColumns`,
`buildFilterSchema`, `buildExpandSchema`, `buildQuerySchema`.
*Gate:* a test proves an unlisted filter field, an unlisted expand path, and a
past-`maxDepth` filter are each rejected with a message naming the offender.

**Phase 4 — `@kit/http`.** Envelopes, cursor encode/decode, `parseBracketQuery` and
`parseCompactQuery`.
*Gate:* round-trip property test — `decodeCursor(encodeCursor(x)) === x`; parser tests
for both wire syntaxes including malformed input.

**Phase 5 — `@kit/drizzle` part one: foundations.** Types, column presets, naming
helpers, `buildWhere`, `applySort`, `applyCursor`, `buildExpand`, `computePatch`.
*Gate:* `computePatch` has explicit tests for every row in the wrapper table above —
atomic arrays, Date normalisation, omitted-vs-null, ignored meta keys.

**Phase 6 — `@kit/drizzle` part two: the repository.** `BaseCrudRepository` with the
five methods, composite PK support, soft delete, optimistic locking, `syncChildren`,
`TransactionHost`.
*Gate:* integration tests against a real Postgres in Docker, including a composite-PK
table and a concurrent-update test proving `ConflictError` fires.

**Phase 7 — `@kit/nest`.** `DbModule`, `BaseCrudService` (with the transactional
read-diff-write flow), `createCrudController`, pipes, guards, filters, interceptors,
decorators, config, bootstrap.
*Gate:* an example app in `examples/` exposes a full CRUD resource; an update sending
one changed field of ten issues an UPDATE touching exactly that field, and an update
sending no changes issues no UPDATE at all.

**Phase 8 — `@kit/testing` and docs.** Factories, `withTestDb`, and a README per
package with a runnable example.
*Gate:* `pnpm -r test` green from a clean clone.

---

## Acceptance criteria

- `pnpm install && pnpm -r build && pnpm -r test` passes from a clean clone
- `@kit/core` has zero runtime dependencies; `@kit/zod` and `@kit/http` import nothing
  from `@kit/drizzle` or `@kit/nest`
- A browser bundle importing `@kit/core`, `@kit/zod` and `@kit/http` contains no NestJS
  and no `pg`
- Updating one field of a ten-field entity issues an UPDATE naming one column
- Updating with an identical payload issues no UPDATE and reports `noop: true`
- A concurrent update with a stale `expectedVersion` throws `ConflictError`
- `search` with 300 child rows and `expand` issues a constant number of queries
- Unlisted filter fields, unlisted expand paths, and over-depth nesting all return 400

---

## Do not

- Add domain concepts. If it mentions a user, an order or a match, it belongs in a
  project's `utils`.
- Add a direct dependency to dodge a peer dependency. Two copies of Zod in one process
  produces type errors that take a day to diagnose.
- Import `@kit/nest` from `@kit/drizzle`. Dependencies point downward only; the
  repository must stay usable from a script with no Nest runtime.
- Re-export `deep-object-diff` directly. It is wrapped for the four reasons above.
- Put the diff in an interceptor or middleware.
- Put business rules in `beforeUpdate` / `afterChange`. Those hooks exist for invariants
  like stamping `updatedBy`, not for workflow.
- Let generated CRUD routes become a public API. They are a starting point for internal
  services.

---

## Open decisions — raise these in your plan

1. **Soft delete default.** Should `delete()` soft-delete by default on every table, or
   only on tables that declare a `deletedAt` column? My inclination is the latter,
   detected at construction, so tables without the column are not silently hard-deleted.
2. **`search` and `total`.** Returning a total count costs a second query. Should it be
   opt-in per request (`?withTotal=true`) or never returned with cursor pagination?
3. **Expand implementation.** Drizzle's relational `with` versus explicit joins — these
   differ in query count and in whether nested `where` is expressible. Which do you
   propose, and what happens when a caller expands two levels?
4. **`Ctx` shape.** `BaseCrudService` takes an optional `ctx` for the actor. Should this
   be an explicit parameter, or ambient via `AsyncLocalStorage` alongside the
   transaction? Explicit is more testable; ambient is less noisy.
5. **Zod version.** Confirm which major is current and whether `buildFilterSchema` can be
   expressed cleanly in it.

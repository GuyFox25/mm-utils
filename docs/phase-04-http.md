# Phase 4 — `@kit/http`

**Goal:** the browser-safe HTTP layer — response envelopes, cursor encode/decode, and pure
query-string parsing shared by the server pipe (Phase 7) and any typed client. No NestJS, no
`pg`.

**Depends on:** Phases 2–3. **Blocks:** Phases 5–8.
**Open decisions:** none directly (but the cursor shape must agree with the `search` decision, #2).

## Why this matters

The query-string parsers here are **pure** `string → object` functions. Keeping them in a
browser-safe package means a typed client and the server pipe parse identically — the wire
format has exactly one implementation. Cursors encode the sort key plus the PK tiebreak, which
is what makes pagination stable under concurrent inserts.

## Implementation targets

### `envelope/`
- [ ] `ok()`, `fail()`, `PaginatedResponse<T>`, `ErrorEnvelope`, `UpdateResult<T>`.
      `UpdateResult` carries `{ row, changedKeys, noop }` — consumed by the no-op interceptor
      in Phase 7.

### `cursor/`
- [ ] `encodeCursor`, `decodeCursor` — base64 of the sort key plus the tiebreak PK.

### `qs/` — pure parsing
- [ ] `parseBracketQuery` — the primary syntax, a **thin wrapper over the `qs` library** (do
      not hand-roll a bracket parser):
      `?filter[status][in]=active,pending&expand=lines,lines.product&sort=-createdAt,id`.
- [ ] `parseCompactQuery` — the compact form where nesting is not needed:
      `?status=in:active,pending`.

### `contracts/`
- [ ] `paginatedResponse(schema)`, `standardErrors`, `listQueryParams` (ts-rest building blocks).

### `status/`
- [ ] `HTTP_STATUS`, `isRetryable(status)`.

## Not in this package — use a library

| Was going to be here | Use instead |
|---|---|
| `createTypedClient` + `bearerAuth`/`retryOn5xx`/`timeout`/`correlationId` interceptors | **`@ts-rest/core`** `initClient` / `initQueryClient`; configure headers, retries and timeouts on the client directly |
| A hand-rolled bracket parser | **`qs`** (wrapped by the `qs/` module above) |

## Verification gate

- [ ] **Cursor round-trip property test:** `decodeCursor(encodeCursor(x)) === x` for arbitrary
      sort-key + PK inputs.
- [ ] Parser tests for **both** wire syntaxes, including malformed input (unbalanced brackets,
      empty values, unknown operators) which must fail cleanly rather than silently mis-parse.

## Notes and pitfalls

- The parsers only turn strings into a nested object; they do **not** validate against an
  allow-list — that is the Zod schema's job (Phase 3), applied by the pipe (Phase 7). Keep the
  two responsibilities separate.
- Coerce values by the target field's schema, never by "looks numeric".

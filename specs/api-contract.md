# API Contract

## Overview
REST API exposed by the NestJS backend ([[backend-spec]]) and consumed by the React frontend ([[frontend-spec]]). JSON over HTTPS. Base URL is the frontend's `VITE_API_BASE_URL`. Endpoint names below follow the checkout flow already defined in [[backend-spec]] Architecture (`create-order` → `capture` ← webhook), rather than a single combined `/cart/pay` call, so that order creation, buyer approval, and PayPal's async webhook confirmation are each handled as separate, idempotent steps.

## Authentication
No end-user login (out of scope — [[goal-spec]]). All endpoints below are unauthenticated at the application layer; access is restricted instead by:
- **CORS** — only the deployed frontend's origin(s) may call these endpoints from a browser ([[backend-spec]] Security Requirements).
- **Webhook authenticity** — `POST /payment/webhook` isn't called by the frontend at all; it's called by PayPal. The backend confirms authenticity by calling PayPal's own `verify-webhook-signature` API (see [[backend-spec]]), not by CORS or a user session.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/items` | List the catalog of 5 sports items. |
| `POST` | `/payment/create-order` | Recompute the total server-side and create a PayPal order + `INITIATED` transaction. |
| `POST` | `/payment/capture` | Capture a PayPal order the buyer has approved and finalize the transaction as `DONE`/`FAILED`. |
| `POST` | `/payment/webhook` | Receive PayPal's async `PAYMENT.CAPTURE.COMPLETED`/`PAYMENT.CAPTURE.DENIED` event (authoritative fallback). |
| `POST` | `/payment/cancel` | Mark a transaction `CANCELLED` when the buyer cancels out of the PayPal flow. |
| `GET` | `/transactions` | List transaction history. |
| `GET` | `/transactions/:id` | Get one transaction's status/detail (used by the Success/Error pages). |

### `GET /items`
**Response `200`:**
```json
[
  { "id": "665f...", "name": "Football", "code": "SPT-001", "imageUrl": "/img/football.png", "price": 5400 }
]
```
`price` is an integer in minor currency units, e.g. cents (see [[backend-spec]] Data Model).

### `POST /payment/create-order`
**Request:**
```json
{ "items": [ { "itemId": "665f...", "quantity": 2 } ] }
```
**Response `201`:**
```json
{
  "transactionId": "66a1...",
  "paypalOrderId": "5O190127TN364715T",
  "amount": 10800,
  "currency": "USD",
  "clientId": "AeA1QgirZ...sandbox-client-id"
}
```
Only `itemId`/`quantity` are sent — price/total are never trusted from the client and are recomputed here ([[backend-spec]] Architecture step 3).

### `POST /payment/capture`
**Request:**
```json
{
  "transactionId": "66a1...",
  "paypalOrderId": "5O190127TN364715T"
}
```
**Response `200`:**
```json
{ "status": "DONE" }
```
or
```json
{ "status": "FAILED", "reason": "INSTRUMENT_DECLINED" }
```
Unlike a signature scheme, there's no client-supplied proof to check here — the backend calls PayPal's own capture endpoint and trusts *that* response directly. A decline is a normal **business outcome**, not a client error — it returns `200` with `status: "FAILED"`, not a `4xx`.

### `POST /payment/webhook`
Called by PayPal only. **Response `200`** `{ "received": true }` once PayPal's verify-webhook-signature API confirms authenticity (required by PayPal to stop retries); **`400`** if verification fails. Applies the same idempotent update as `/payment/capture` (see [[backend-spec]] Idempotency).

### `POST /payment/cancel`
**Request:**
```json
{ "transactionId": "66a1..." }
```
**Response `200`:**
```json
{ "status": "CANCELLED" }
```
Called when the buyer cancels out of the PayPal flow ([[frontend-spec]]) so an abandoned checkout doesn't stay stuck at `INITIATED` forever. Only transitions a transaction that is still `INITIATED`; if it has already reached `DONE`/`FAILED` (e.g. the webhook beat the cancel event), the existing status is kept and returned as-is rather than overwritten — same idempotent-update rule as `/payment/capture`.

### `GET /transactions`
**Response `200`:** array of transaction summaries, newest first:
```json
[
  { "id": "66a1...", "status": "DONE", "amount": 10800, "currency": "USD", "createdAt": "2026-09-19T10:00:00Z" }
]
```

### `GET /transactions/:id`
**Response `200`:** full transaction detail (status, amount, item snapshot, paymentMethod, failureReason if any — see [[backend-spec]] Data Model). **`404`** if the id doesn't exist.

## Request / Response Schemas
**Item**
| Field | Type |
|---|---|
| `id` | string |
| `name` | string |
| `code` | string |
| `imageUrl` | string |
| `price` | integer (minor units) |

**Transaction**
| Field | Type |
|---|---|
| `id` | string |
| `status` | `INITIATED` \| `DONE` \| `FAILED` \| `CANCELLED` |
| `amount` | integer (minor units) |
| `currency` | string (`USD`) |
| `items` | array of `{ itemId, name, unitPrice, quantity }` |
| `paymentMethod` | `paypal` \| `null` |
| `failureReason` | string \| `null` |
| `createdAt` | ISO 8601 datetime |

All responses use these shapes consistently; `/transactions` returns a trimmed subset of the `Transaction` fields (`id`, `status`, `amount`, `currency`, `createdAt`) while `/transactions/:id` returns the full object.

## Error Handling
- Standard NestJS error shape: `{ "statusCode": number, "message": string | string[], "error": string }`.
- `400 Bad Request` — validation failures (e.g. missing `itemId`, `quantity <= 0`), via `class-validator` DTOs.
- `404 Not Found` — unknown `itemId` in `create-order`, unknown `:id` in `GET /transactions/:id`, or unknown `transactionId` in `/payment/cancel`.
- `400 Bad Request` — PayPal's verify-webhook-signature check fails on `POST /payment/webhook`.
- `500 Internal Server Error` — unexpected failures (e.g. PayPal API unreachable); the response body must **never** include PayPal API internals, stack traces, or the client secret ([[frontend-spec]] UX/Security: don't leak gateway internals to the client).
- A failed/declined payment is **not** an HTTP error — see `/payment/capture` above; it's a normal `200` response carrying `status: "FAILED"`.

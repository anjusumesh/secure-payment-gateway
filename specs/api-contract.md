# API Contract

## Overview
REST API exposed by the NestJS backend ([[backend-spec]]) and consumed by the React frontend ([[frontend-spec]]). JSON over HTTPS. Base URL is the frontend's `VITE_API_BASE_URL`. Endpoint names below follow the checkout flow already defined in [[backend-spec]] Architecture (`create-order` → `verify` ← webhook), rather than a single combined `/cart/pay` call, so that order creation, client-side confirmation, and Razorpay's async webhook confirmation are each handled as separate, idempotent steps.

## Authentication
No end-user login (out of scope — [[goal-spec]]). All endpoints below are unauthenticated at the application layer; access is restricted instead by:
- **CORS** — only the deployed frontend's origin(s) may call these endpoints from a browser ([[backend-spec]] Security Requirements).
- **Webhook signature** — `POST /payment/webhook` isn't called by the frontend at all; it's called by Razorpay and is authenticated via the `X-Razorpay-Signature` header (HMAC using the webhook secret), not by CORS or a user session.

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| `GET` | `/items` | List the catalog of 5 sports items. |
| `POST` | `/payment/create-order` | Recompute the total server-side and create a Razorpay order + `INITIATED` transaction. |
| `POST` | `/payment/verify` | Verify the payment signature returned by Checkout.js and finalize the transaction as `DONE`/`FAILED`. |
| `POST` | `/payment/webhook` | Receive Razorpay's async `payment.captured`/`payment.failed` event (authoritative fallback). |
| `GET` | `/transactions` | List transaction history. |
| `GET` | `/transactions/:id` | Get one transaction's status/detail (used by the Success/Error pages). |

### `GET /items`
**Response `200`:**
```json
[
  { "id": "665f...", "name": "Football", "code": "SPT-001", "imageUrl": "/img/football.png", "price": 5400 }
]
```
`price` is an integer in paise (see [[backend-spec]] Data Model).

### `POST /payment/create-order`
**Request:**
```json
{ "items": [ { "itemId": "665f...", "quantity": 2 } ] }
```
**Response `201`:**
```json
{
  "transactionId": "66a1...",
  "razorpayOrderId": "order_ABC123",
  "amount": 10800,
  "currency": "INR",
  "keyId": "rzp_test_xxxxx"
}
```
Only `itemId`/`quantity` are sent — price/total are never trusted from the client and are recomputed here ([[backend-spec]] Architecture step 2).

### `POST /payment/verify`
**Request:**
```json
{
  "transactionId": "66a1...",
  "razorpayOrderId": "order_ABC123",
  "razorpayPaymentId": "pay_XYZ789",
  "razorpaySignature": "3f2504e0..."
}
```
**Response `200`:**
```json
{ "status": "DONE" }
```
or
```json
{ "status": "FAILED", "reason": "Signature verification failed" }
```
A signature mismatch or gateway-reported decline is a normal **business outcome**, not a client error — it returns `200` with `status: "FAILED"`, not a `4xx`.

### `POST /payment/webhook`
Called by Razorpay only, with header `X-Razorpay-Signature`. **Response `200`** `{ "received": true }` on success (required by Razorpay to stop retries); **`400`** if the signature doesn't verify. Applies the same idempotent update as `/payment/verify` (see [[backend-spec]] Idempotency).

### `GET /transactions`
**Response `200`:** array of transaction summaries, newest first:
```json
[
  { "id": "66a1...", "status": "DONE", "amount": 10800, "currency": "INR", "createdAt": "2026-09-19T10:00:00Z" }
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
| `price` | integer (paise) |

**Transaction**
| Field | Type |
|---|---|
| `id` | string |
| `status` | `INITIATED` \| `DONE` \| `FAILED` \| `CANCELLED` |
| `amount` | integer (paise) |
| `currency` | string (`INR`) |
| `items` | array of `{ itemId, name, unitPrice, quantity }` |
| `paymentMethod` | `card` \| `upi` \| `netbanking` \| `null` |
| `failureReason` | string \| `null` |
| `createdAt` | ISO 8601 datetime |

All responses use these shapes consistently; `/transactions` returns a trimmed subset of the `Transaction` fields (`id`, `status`, `amount`, `currency`, `createdAt`) while `/transactions/:id` returns the full object.

## Error Handling
- Standard NestJS error shape: `{ "statusCode": number, "message": string | string[], "error": string }`.
- `400 Bad Request` — validation failures (e.g. missing `itemId`, `quantity <= 0`), via `class-validator` DTOs.
- `404 Not Found` — unknown `itemId` in `create-order`, or unknown `:id` in `GET /transactions/:id`.
- `400 Bad Request` — invalid/missing webhook signature on `POST /payment/webhook`.
- `500 Internal Server Error` — unexpected failures (e.g. Razorpay API unreachable); the response body must **never** include Razorpay SDK internals, stack traces, or the key secret/webhook secret ([[frontend-spec]] UX/Security: don't leak gateway internals to the client).
- A failed/declined payment is **not** an HTTP error — see `/payment/verify` above; it's a normal `200` response carrying `status: "FAILED"`.

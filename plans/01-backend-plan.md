# Backend Implementation Plan

Implements `specs/backend-spec.md` and `specs/api-contract.md`. Covers roadmap Phases 1–2 (`plans/00-roadmap.md`).

## 1. Project Setup
- [ ] `npx @nestjs/cli new backend` (TypeScript).
- [ ] Install: `@nestjs/mongoose mongoose razorpay class-validator class-transformer @nestjs/config`.
- [ ] `.env` (gitignored): `MONGODB_URI`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `CORS_ALLOWED_ORIGINS`, `PORT`.
- [ ] Global `ConfigModule` (`isGlobal: true`) to load env vars.
- [ ] Global `ValidationPipe` (`whitelist: true, transform: true`) in `main.ts`.
- [ ] CORS configured from `CORS_ALLOWED_ORIGINS` (comma-split allowlist — no wildcard, per `backend-spec.md` Security Requirements).

## 2. Items Module
- [ ] `Item` Mongoose schema: `name`, `code`, `imageUrl`, `price` (integer, paise) — per `backend-spec.md` Data Model.
- [ ] One-off seed script that inserts the 5 sports items if the `items` collection is empty (run manually, not on every boot).
- [ ] `ItemsService.findAll()`.
- [ ] `ItemsController` → `GET /items` (per `api-contract.md`).

## 3. Transactions Module
- [ ] `Transaction` Mongoose schema per `backend-spec.md` Data Model (`razorpayOrderId` unique, `status` enum `INITIATED|DONE|FAILED|CANCELLED`, `items` snapshot array, `paymentMethod`, `failureReason`, timestamps).
- [ ] `TransactionsService`: `create()`, `findAll()`, `findById()`, `updateStatusIfInitiated(razorpayOrderId, patch)` — the idempotency-safe update used by verify/cancel/webhook (only overwrites a still-`INITIATED` document, or is a same-status no-op).
- [ ] `TransactionsController` → `GET /transactions`, `GET /transactions/:id` (404 on unknown id).

## 4. Payment Module — Create Order
- [ ] Razorpay SDK client instantiated from `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`.
- [ ] `CreateOrderDto`: `items: { itemId: string; quantity: number }[]` (validated: non-empty, `quantity >= 1`).
- [ ] `POST /payment/create-order`:
  1. Look up each `itemId` via `ItemsService` — 404 if any is unknown.
  2. Compute `amount` server-side (never trust a client total — `frontend-spec.md` UX/Security).
  3. Create a Razorpay order (Orders API) for `amount`.
  4. Create a `Transaction` (`status: INITIATED`, `amount`, `items` snapshot, `razorpayOrderId`).
  5. Return `{ transactionId, razorpayOrderId, amount, currency, keyId }` (per `api-contract.md`).

## 5. Payment Module — Verify
- [ ] `VerifyPaymentDto`: `transactionId`, `razorpayOrderId`, `razorpayPaymentId`, `razorpaySignature`.
- [ ] `POST /payment/verify`:
  1. Recompute HMAC-SHA256 of `razorpayOrderId|razorpayPaymentId` using `RAZORPAY_KEY_SECRET`; compare to `razorpaySignature`.
  2. On match → `updateStatusIfInitiated(razorpayOrderId, { status: 'DONE', razorpayPaymentId, paymentMethod })`.
  3. On mismatch → `updateStatusIfInitiated(razorpayOrderId, { status: 'FAILED', failureReason })`.
  4. Return `{ status }` (`200` either way — a failed/declined payment is a normal outcome, not an HTTP error, per `api-contract.md`).

## 6. Payment Module — Cancel & Webhook
- [ ] `POST /payment/cancel` (`{ transactionId }`): `updateStatusIfInitiated(..., { status: 'CANCELLED' })`; if already terminal, just return the existing status unchanged.
- [ ] `POST /payment/webhook`:
  - Configure this route to receive the **raw** request body (not JSON-parsed) — HMAC verification needs the raw bytes.
  - Verify `X-Razorpay-Signature` against `RAZORPAY_WEBHOOK_SECRET`; `400` if invalid.
  - On `payment.captured` → same idempotent update to `DONE`; on `payment.failed` → `FAILED`.
  - Always respond `200 { received: true }` once the signature is valid (Razorpay retries otherwise).

## 7. Error Handling
- [ ] Global exception filter shaping `{ statusCode, message, error }`, and ensuring any unexpected `500` never leaks Razorpay SDK internals, stack traces, or secrets (`api-contract.md` Error Handling).
- [ ] Never log full webhook bodies, signatures, or key secret/webhook secret values.

## 8. Testing
- [ ] Unit test: server-side amount calculation (`create-order`) ignores/overrides any client-supplied price.
- [ ] Unit test: signature verification against known good/bad fixtures.
- [ ] Unit test: `updateStatusIfInitiated` is a no-op when the transaction is already terminal (idempotency).
- [ ] Manual (Postman/curl): full create-order → verify happy path with a Razorpay test card; confirm `Transaction` reaches `DONE`.
- [ ] Manual: Razorpay test **failure** card; confirm `FAILED` and that no capture occurred (check the Razorpay Test Mode dashboard).

## 9. Local Webhook Testing
- [ ] Run a tunnel (e.g. `ngrok http <port>`) to get a temporary public URL.
- [ ] Register that URL as the Razorpay Test Mode webhook endpoint (subscribing to `payment.captured`, `payment.failed`) to test the webhook path before the first real deploy.

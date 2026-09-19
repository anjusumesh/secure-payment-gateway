# Backend Spec

## Overview
A NestJS API that manages the cart-to-payment flow: creates Razorpay orders, verifies payment results, persists transaction history in MongoDB, and exposes transaction status to the frontend. See [[goal-spec]] and [[frontend-spec]].

## Tech Stack
- NestJS (Node.js/TypeScript)
- Razorpay Node SDK, using **Test Mode** API keys (sandbox — no real money moves)
- Mongoose (MongoDB ODM)

## Architecture
**Modules:**
- `ItemsModule` — serves the fixed catalog of 5 sports items ([[goal-spec]]). Source of truth for prices; seeded once (no admin CRUD, out of scope).
- `PaymentModule` — creates Razorpay orders, verifies payment signatures, and receives Razorpay webhooks.
- `TransactionsModule` — persists and exposes transaction history/status ([[goal-spec]] Transaction History).

**Checkout flow** (see [[frontend-spec]] for the corresponding UI steps):
1. Frontend fetches the catalog from `GET /items` and builds a cart client-side.
2. At checkout, frontend sends the cart (item ids + quantities only — no prices) to the backend. The backend recomputes the total **server-side** from `ItemsModule`, never trusting a client-supplied total ([[frontend-spec]] UX/Security).
3. Backend creates a Razorpay Order (Razorpay Orders API) for that verified amount, creates a local `Transaction` document with status `INITIATED`, and returns the Razorpay order id + amount + public key id to the frontend.
4. Frontend opens Razorpay Checkout.js against that order id ([[frontend-spec]]).
5. On completion, Razorpay returns a payment id, order id, and signature to the frontend, which forwards them to `POST /payment/verify`. The backend recomputes the HMAC signature using the **key secret** and updates the `Transaction` to `DONE` (valid + captured) or `FAILED` (invalid signature or gateway-reported failure).
6. Razorpay also sends an asynchronous **webhook** (`payment.captured` / `payment.failed`) to the backend as the authoritative fallback, in case step 5 never completes (e.g. the browser tab closes before the frontend can call `/payment/verify`). The webhook handler applies the same idempotent update.
7. If the user closes the Checkout widget without paying, the frontend reports this so the backend can mark the `Transaction` `CANCELLED` rather than leaving it stuck at `INITIATED`.

**Idempotency:** both `/payment/verify` and the webhook handler look up the `Transaction` by `razorpayOrderId` and update it rather than creating a new record, so a retried request or a webhook arriving after `/payment/verify` already ran does not double-process the same payment ([[goal-spec]] Idempotency).

## Data Model
MongoDB storage (via Mongoose), two collections:

**`items`** — the fixed catalog:
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | e.g. "Football" |
| `code` | string | product code shown in the UI ([[frontend-spec]] Layout Reference) |
| `imageUrl` | string | |
| `price` | number (integer, paise) | stored in the smallest currency unit (paise) to avoid floating-point rounding, per Razorpay's convention |

**`transactions`** — one document per checkout attempt:
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `razorpayOrderId` | string | unique; used for idempotent lookups |
| `razorpayPaymentId` | string \| null | set once a payment attempt exists |
| `status` | `INITIATED` \| `DONE` \| `FAILED` \| `CANCELLED` | `INITIATED` is an internal pre-final state; `DONE`/`FAILED`/`CANCELLED` are the final statuses from [[goal-spec]] |
| `amount` | number (integer, paise) | server-computed total, not client-supplied |
| `currency` | string | `INR` |
| `items` | array of `{ itemId, name, unitPrice, quantity }` | a **snapshot** at purchase time, so history stays accurate even if the catalog changes later |
| `paymentMethod` | string \| null | `card` \| `upi` \| `netbanking`, filled in once known |
| `failureReason` | string \| null | Razorpay's error description, if any |
| `createdAt` / `updatedAt` | Date | |

## Security Requirements
- Ensure secure payment handling; choose the best practices available for a demo of this scope.
- **CORS:** restrict allowed origins to the deployed frontend's Vercel domain(s) — the production domain plus this project's Vercel preview URL pattern during development ([[frontend-spec]]). Do not use a wildcard (`*`) origin, since credentials/cookies or sensitive responses may be involved.
- Keep the Razorpay **key secret** and **webhook secret** in backend environment variables only — never returned in any API response or logged.

## Third-Party Integrations
- **Razorpay** (test/sandbox mode), specifically:
  - **Orders API** — to create an order before checkout ([[frontend-spec]] Payment page).
  - **Payment signature verification** — HMAC-SHA256 over `order_id|payment_id` using the key secret, done server-side only.
  - **Webhooks** — `payment.captured` / `payment.failed` events, verified using the separate webhook secret, as the authoritative fallback confirmation.

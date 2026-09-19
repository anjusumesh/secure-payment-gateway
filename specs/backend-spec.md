# Backend Spec

## Overview
A NestJS API that manages the cart-to-payment flow: creates PayPal orders, captures approved payments, persists transaction history in MongoDB, and exposes transaction status to the frontend. See [[goal-spec]] and [[frontend-spec]].

## Tech Stack
- NestJS (Node.js/TypeScript)
- PayPal REST API (Orders v2), called directly with Node's built-in `fetch` — no PayPal SDK dependency, since the REST surface is small and this is a learning project
- Mongoose (MongoDB ODM)

## Architecture
**Modules:**
- `ItemsModule` — serves the fixed catalog of 5 sports items ([[goal-spec]]). Source of truth for prices; seeded once (no admin CRUD, out of scope).
- `PaymentModule` — obtains PayPal OAuth2 access tokens, creates/captures PayPal orders, and receives PayPal webhooks.
- `TransactionsModule` — persists and exposes transaction history/status ([[goal-spec]] Transaction History).

**Checkout flow** (see [[frontend-spec]] for the corresponding UI steps):
1. Frontend fetches the catalog from `GET /items` and builds a cart client-side.
2. The frontend renders PayPal's Smart Payment Buttons immediately (they need only the public PayPal client id, not an order yet — [[frontend-spec]] Deployment).
3. When the buyer clicks a button, the SDK calls the frontend's `createOrder` callback, which calls `POST /payment/create-order` with the cart (item ids + quantities only — no prices). The backend recomputes the total **server-side** from `ItemsModule`, never trusting a client-supplied total ([[frontend-spec]] UX/Security), gets an OAuth2 access token (`POST /v1/oauth2/token`, client-credentials grant), creates a PayPal order (`POST /v2/checkout/orders`, `intent: CAPTURE`) for that verified amount, creates a local `Transaction` document with status `INITIATED`, and returns the PayPal order id + amount + public client id to the frontend.
4. The buyer approves the payment in PayPal's own UI (popup or redirect, driven entirely by the PayPal SDK).
5. On approval, the frontend calls `POST /payment/capture` with the transaction id and PayPal order id. The backend calls PayPal's `POST /v2/checkout/orders/{id}/capture` directly — there is no client-supplied signature to verify here (unlike Razorpay's model); PayPal's own capture response is the source of truth — and updates the `Transaction` to `DONE` (capture status `COMPLETED`) or `FAILED` (any other outcome, e.g. `INSTRUMENT_DECLINED`).
6. PayPal also sends an asynchronous **webhook** (`PAYMENT.CAPTURE.COMPLETED` / `PAYMENT.CAPTURE.DENIED`) to the backend as the authoritative fallback, in case step 5 never completes (e.g. the browser tab closes before the frontend can call `/payment/capture`). The webhook handler applies the same idempotent update, after verifying the webhook via PayPal's own `POST /v1/notifications/verify-webhook-signature` API (PayPal verifies its own signature server-to-server, rather than handing us a shared secret to HMAC locally).
7. If the buyer cancels out of the PayPal flow, the frontend calls `POST /payment/cancel` ([[api-contract]]) so the backend can mark the `Transaction` `CANCELLED` rather than leaving it stuck at `INITIATED`.

**Idempotency:** both `/payment/capture` and the webhook handler look up the `Transaction` by `paypalOrderId` and update it rather than creating a new record, so a retried request or a webhook arriving after `/payment/capture` already ran does not double-process the same payment ([[goal-spec]] Idempotency).

## Data Model
MongoDB storage (via Mongoose), two collections:

**`items`** — the fixed catalog:
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `name` | string | e.g. "Football" |
| `code` | string | product code shown in the UI ([[frontend-spec]] Layout Reference) |
| `imageUrl` | string | |
| `price` | number (integer, minor units) | stored as an integer (e.g. cents) to avoid floating-point rounding; converted to PayPal's decimal string format (e.g. `"54.00"`) only at the API boundary |

**`transactions`** — one document per checkout attempt:
| Field | Type | Notes |
|---|---|---|
| `_id` | ObjectId | |
| `paypalOrderId` | string | unique; used for idempotent lookups |
| `paypalCaptureId` | string \| null | set once a capture attempt exists |
| `status` | `INITIATED` \| `DONE` \| `FAILED` \| `CANCELLED` | `INITIATED` is an internal pre-final state; `DONE`/`FAILED`/`CANCELLED` are the final statuses from [[goal-spec]] |
| `amount` | number (integer, minor units) | server-computed total, not client-supplied |
| `currency` | string | `USD` |
| `items` | array of `{ itemId, name, unitPrice, quantity }` | a **snapshot** at purchase time, so history stays accurate even if the catalog changes later |
| `paymentMethod` | string \| null | `paypal`, filled in once known (PayPal Checkout doesn't expose a finer-grained method for this integration) |
| `failureReason` | string \| null | PayPal's error description, if any |
| `createdAt` / `updatedAt` | Date | |

## Security Requirements
- Ensure secure payment handling; choose the best practices available for a demo of this scope.
- **CORS:** restrict allowed origins to the deployed frontend's Vercel domain(s) — the production domain plus this project's Vercel preview URL pattern during development ([[frontend-spec]]). Do not use a wildcard (`*`) origin, since credentials/cookies or sensitive responses may be involved.
- Keep the PayPal **client secret** in backend environment variables only — never returned in any API response or logged. (The client *id* is not secret — see Configuration below and [[frontend-spec]] Deployment.)
- Cache the OAuth2 access token in memory (it's valid for several hours) rather than requesting a fresh one per API call; never log it.

**Configuration (backend environment variables):**
| Variable | Purpose |
|---|---|
| `MONGODB_URI` | MongoDB connection string. |
| `PAYPAL_API_BASE` | `https://api-m.sandbox.paypal.com` in development, `https://api-m.paypal.com` in production. |
| `PAYPAL_CLIENT_ID` | PayPal app client id. Not secret by design — also used by the frontend to load the PayPal SDK script directly ([[frontend-spec]] Deployment), unlike Razorpay's key id which the frontend only ever received via an API response. |
| `PAYPAL_CLIENT_SECRET` | Used server-side only, to obtain OAuth2 access tokens. |
| `PAYPAL_WEBHOOK_ID` | The webhook's id (from the PayPal Developer Dashboard), passed to PayPal's verify-webhook-signature API — PayPal does the actual cryptographic verification, not this backend. |
| `CORS_ALLOWED_ORIGINS` | The frontend's Vercel production + preview origin(s). |

## Third-Party Integrations
- **PayPal** (Sandbox), specifically:
  - **OAuth2 token endpoint** (`POST /v1/oauth2/token`) — client-credentials grant using `PAYPAL_CLIENT_ID`/`PAYPAL_CLIENT_SECRET`, to authenticate all other calls.
  - **Orders API v2** — `POST /v2/checkout/orders` (create, `intent: CAPTURE`) and `POST /v2/checkout/orders/{id}/capture` (capture after buyer approval).
  - **Webhooks** — `PAYMENT.CAPTURE.COMPLETED` / `PAYMENT.CAPTURE.DENIED` events, confirmed authentic via PayPal's own `POST /v1/notifications/verify-webhook-signature` API (using `PAYPAL_WEBHOOK_ID`), as the authoritative fallback confirmation.

## Deployment
- **Host:** Render (Web Service), deployed from the same git repo as the frontend. Build command `npm install && npm run build`; start command `npm run start:prod`. The app must read its listen port from `process.env.PORT` (Render assigns this).
- **Database:** MongoDB Atlas (free M0 cluster) — `MONGODB_URI` (see Configuration above) points at Atlas from any host, so no self-managed database server is needed.
- **Environment variables:** set in Render's dashboard (not committed) — the same set listed in Configuration above.
- **PayPal webhook:** configured in the PayPal Developer Dashboard (on the Sandbox app) only once the Render URL is known, pointed at `https://<service>.onrender.com/payment/webhook`; the resulting webhook id is then added to Render as `PAYPAL_WEBHOOK_ID`.
- **CORS:** `CORS_ALLOWED_ORIGINS` is updated once the frontend's real Vercel URL is known ([[frontend-spec]] Deployment), rather than left open during initial backend deploy.
- **Cold starts:** Render's free tier spins the service down on inactivity — the first request after idle time may be noticeably slow. Acceptable for a learning demo; would need a paid tier or a keep-alive ping to avoid in a real product.

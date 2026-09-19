# Frontend Implementation Plan

Implements `specs/frontend-spec.md` against the backend from `01-backend-plan.md`. Covers roadmap Phases 3–4 (`plans/00-roadmap.md`). Assumes the Vite `react-ts` template, for consistency with the backend's TypeScript.

## 1. Project Setup
- [ ] `npm create vite@latest frontend -- --template react-ts`.
- [ ] Install: `react-router-dom axios`.
- [ ] `.env.local` (gitignored): `VITE_API_BASE_URL`.
- [ ] Add Fira Sans via a Google Fonts `<link>` in `index.html`, with the fallback stack from `frontend-spec.md` Visual Design.
- [ ] Define the color tokens (`--color-bg`, `--color-bg-secondary`, `--color-primary`, etc., plus the `DONE`/`FAILED`/`CANCELLED` status colors) as CSS custom properties in a global stylesheet.
- [ ] Add `vercel.json` with a SPA catch-all rewrite to `/index.html` (or confirm Vercel's Vite framework preset handles it) — needed before Phase 5 deploy.

## 2. Routing & Layout
- [ ] Routes: `/` (Item List), `/cart`, `/payment`, `/payment/success`, `/payment/error`.
- [ ] `Header` component showing the cart item count (reads `CartContext`).

## 3. Cart State
- [ ] `CartContext` + `useReducer` (actions: add item, remove item, set quantity, clear cart; derived total).
- [ ] `useCart()` hook wrapping the context.

## 4. Item List Page
- [ ] `itemsService.getAll()` (axios `GET /items`).
- [ ] `ItemList` fetches on mount; renders one `ItemCard` per item (thumbnail on light-brown background, name, code, price, "Add to Cart") per the Layout Reference card style.

## 5. Cart Page
- [ ] `CartItem` row: thumbnail, name + code, `QuantityStepper` (`− [qty] +`), unit price, line total, remove (`×`).
- [ ] `OrderSummary` sidebar: "Total" heading, Sub-Total, dark-blue "Check Out" button, accepted-methods row (Card/UPI/Net Banking) — no delivery row (out of scope).
- [ ] "Check Out" disabled when the cart is empty; navigates to `/payment`.

## 6. Payment Page
- [ ] `paymentService`: `createOrder(items)`, `verify(payload)`, `cancel(transactionId)` (axios calls per `api-contract.md`).
- [ ] On entry: call `createOrder` with the cart's `{ itemId, quantity }` pairs → receive `{ transactionId, razorpayOrderId, amount, currency, keyId }`.
- [ ] Load Razorpay's `checkout.js` from its official CDN (once, e.g. in `index.html` or a lazy script loader — never from any other host, per `frontend-spec.md` UX/Security).
- [ ] Build Razorpay options from the `create-order` response (`key: keyId`, `order_id: razorpayOrderId`, `amount`, `currency`):
  - `handler(response)` → call `paymentService.verify({ transactionId, razorpayOrderId, razorpayPaymentId, razorpaySignature })` → navigate to `/payment/success` or `/payment/error` based on the returned `status`.
  - `modal.ondismiss` → call `paymentService.cancel(transactionId)` → navigate to `/payment/error`.
- [ ] Disable the trigger button after first click — don't call `createOrder` twice for one checkout attempt.
- [ ] Show a loading/pending state while awaiting the Razorpay response; never assume success before the backend confirms it.

## 7. Success / Error Pages
- [ ] Pass `transactionId` via route state (or a query param) into `/payment/success` / `/payment/error`.
- [ ] Fetch `GET /transactions/:id` to display the confirmed status, amount, and reference.
- [ ] `PaymentSuccess`: `DONE` styling (green, checkmark icon) — see `frontend-spec.md` Visual Design accessibility note (icon + color, not color alone).
- [ ] `PaymentError`: handles both `FAILED` (red, "×" icon) and `CANCELLED` (muted brown-gray) with distinct copy; "Try Again" returns to `/cart`.

## 8. Styling / Theming Pass
- [ ] Apply the color tokens and Fira Sans consistently across all pages.
- [ ] Spot-check contrast (dark blue on white/light-brown, white on dark-blue buttons) per the Visual Design accessibility notes.

## 9. Manual Testing (against the Phase 2 backend, local or tunneled)
- [ ] Happy path: browse → cart → pay with a Razorpay test **success** card → Success page shows correct amount/reference.
- [ ] Failure path: Razorpay test **failure** card → Error page shown; confirm via the backend's `GET /transactions/:id` that no amount was captured.
- [ ] Cancel path: open Checkout, close it without paying → Error page, transaction recorded as `CANCELLED`.
- [ ] Duplicate-click check: rapidly click "Check Out"/"Pay" — confirm only one order/transaction is created.

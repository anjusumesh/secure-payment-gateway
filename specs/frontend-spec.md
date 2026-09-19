# Frontend Spec

## Overview
A React single-page app that lets a user browse a small catalog of sports items, build a cart, and complete a demo payment via PayPal Checkout (PayPal Sandbox), ending on a success or error page depending on the outcome.

## Tech Stack
- React (latest, with functional components + hooks)
- React Router for page navigation
- React Context (or Redux Toolkit if state grows beyond the cart) for shared state
- Axios (or `fetch`) for calling the NestJS backend ([[backend-spec]])
- PayPal JS SDK (Smart Payment Buttons) — loaded on the Payment page to render the PayPal checkout button and drive the buyer's approval flow
- Fira Sans (Google Fonts) as the app's typeface
- Vite as the build tool (Vercel auto-detects it; fast local dev server)
- Hosted on **Vercel** (static build + CDN, no server-side rendering needed for this app)

## Visual Design
**Font:** Fira Sans, loaded via Google Fonts, with a system-font fallback stack: `'Fira Sans', -apple-system, Segoe UI, Roboto, sans-serif`.

**Color palette:**
| Token | Value | Usage |
|---|---|---|
| `--color-bg` | White `#FFFFFF` | Page background |
| `--color-bg-secondary` | Light brown `#E8DCC9` | Cards, panels, section backgrounds (e.g. cart summary, item cards) |
| `--color-primary` | Dark blue `#14213D` | Primary buttons (Add to Cart, Pay), header/nav, links, headings |
| `--color-primary-hover` | Darker blue `#0E1830` | Hover/active state of primary elements |
| `--color-text` | Dark blue `#14213D` | Body text on white/light-brown backgrounds |
| `--color-text-on-primary` | White `#FFFFFF` | Text/icons on dark blue buttons |

**Status colors** (for transaction outcomes — see [[goal-spec]] Transaction Status), kept distinct from the core palette so DONE/FAILED/CANCELLED stay visually unambiguous:
| Status | Color | Usage |
|---|---|---|
| `DONE` | Green `#2E7D32` | Success page, success badges |
| `FAILED` | Red `#C62828` | Error page, failure badges |
| `CANCELLED` | Muted brown-gray `#8A7B6C` | Cancelled badges (distinct from FAILED red) |

**Accessibility notes:**
- Dark blue (`#14213D`) on white and on light brown (`#E8DCC9`) both meet WCAG AA contrast for body text.
- White text on dark blue buttons meets AA contrast; verify with a contrast checker once final hexes are locked in.
- Don't rely on color alone for transaction status — pair each status color with a text label/icon (e.g. a checkmark for DONE, an X for FAILED) for colorblind users.

## Layout Reference
Structural style reference: `images/e-commerce.png`. **Layout/structure only** — colors are re-themed to this project's palette above (the mockup's pink thumbnails and red button are not used).

**Cart page** — two-column layout:
- **Left (item list):** each cart item is its own white card/row (subtle border, no heavy shadow) containing, left to right: a square thumbnail with a light-brown (`--color-bg-secondary`) background, product name (bold, dark blue) + product code (small, muted gray) beneath it, a quantity stepper (`−` `01` `+`), unit price, line total (bold), and a remove ("×") icon at the far right.
- **Right (order summary):** a fixed sidebar with "Total" heading, Sub-Total row, a full-width rounded **dark blue** "Check Out" button (in place of the mockup's red) that navigates to the Payment page where the actual PayPal button renders, and a "We Accept" row showing **PayPal** — the one payment method this project integrates (the mockup's Stripe/Apple Pay/WebMoney icons don't apply here, though its PayPal icon now happens to match). The mockup's **Delivery row is dropped** — delivery/shipping is out of scope (see [[goal-spec]]).

This same card-row pattern (thumbnail + name/code + price, on a white card with light-brown accents) carries over to the **Item List** page for consistency, minus the quantity stepper (replaced by a single "Add to Cart" button there).

## Deployment
- **Host:** Vercel, deploying the Vite production build (`vite build`) as a static site on Vercel's CDN.
- **Client-side routing:** React Router needs a SPA rewrite rule (`vercel.json` with a catch-all rewrite to `/index.html`, or Vercel's framework preset for Vite/SPA) so that a hard refresh/direct link on `/cart`, `/payment`, etc. doesn't 404.
- **Environment variables:** set in the Vercel project settings (not committed to the repo):
  - `VITE_API_BASE_URL` — the deployed NestJS backend's URL ([[backend-spec]]).
  - `VITE_PAYPAL_CLIENT_ID` — PayPal's public client id, needed to load the PayPal SDK script (`https://www.paypal.com/sdk/js?client-id=...`) *before* any order exists, so the buttons can render as soon as the Payment page loads. This is a deliberate difference from the earlier Razorpay design: Razorpay's key was only needed once an order already existed, so it could come from the `create-order` response alone; PayPal's SDK needs a client id up front. The client id is not secret ([[backend-spec]] Configuration) — only the client **secret** stays backend-only.
- **HTTPS:** provided automatically by Vercel, satisfying the HTTPS-only requirement below.
- **Preview deployments:** every branch/PR gets its own Vercel preview URL. The backend's CORS allowlist ([[backend-spec]]) needs to account for these in addition to the production domain (e.g. allow the production domain plus a `*.vercel.app` pattern for this project during development).

## Pages / Screens
| Page | Purpose |
|---|---|
| **Item List** | Landing page. Shows the 5 sports items (name, image, price) with an "Add to Cart" button on each. |
| **Cart** | Two-column layout (see [Layout Reference](#layout-reference)): item rows with quantity stepper and line total on the left, an order summary sidebar with grand total and "Check Out" button on the right. |
| **Payment** | Renders the PayPal button (SDK loaded with `VITE_PAYPAL_CLIENT_ID`); on click it requests a PayPal order from the backend, then hands off to PayPal's own approval flow. |
| **Success** | Confirms the transaction completed, shows an order/transaction reference and amount paid. |
| **Error / Failure** | Shown when a transaction fails or is cancelled; explains the outcome and lets the user retry or return to the cart. |

## Components
- `ItemList` / `ItemCard` — renders the catalog and the "Add to Cart" action.
- `Cart` / `CartItem` — renders selected items, quantities, and running total (see [Layout Reference](#layout-reference)).
- `QuantityStepper` — the `− [qty] +` control used on each `CartItem` row.
- `OrderSummary` — the right-hand sidebar on the Cart page (Sub-Total, Check Out button, accepted-methods row — no delivery/shipping, out of scope).
- `Payment` — renders PayPal's Smart Payment Buttons into a container; its `createOrder` callback calls the backend to create a PayPal order, its `onApprove` callback calls `/payment/capture`, and its `onCancel` callback calls `paymentService.cancel()`.
- `PaymentSuccess` — success confirmation view.
- `PaymentError` — failure/cancellation view.
- `Header` — shared nav bar (e.g. cart item count).
- `CartContext` (+ `useCart` hook) — holds cart state and exposes add/remove/total logic to components.
- `paymentService` (plain module, not a component) — calls the backend to create a PayPal order, capture/fetch the final transaction status, and cancel an abandoned checkout (`POST /payment/cancel`, [[api-contract]]).

## State Management
- Cart state held client-side in `CartContext` (React Context + `useReducer`/`useState`), not persisted server-side until checkout begins.
- Transaction/payment status is authoritative on the backend ([[backend-spec]]); the frontend reads the status the backend returns (after PayPal's callback/webhook updates it) rather than deciding success/failure itself.
- No sensitive payment data (card numbers, CVV, PayPal login) is ever held in React state or `localStorage` — those are entered directly into PayPal's own hosted checkout flow, never into this app's own form fields.

## UX / Security Considerations
- Disable/hide the PayPal button area once a capture is in flight to prevent duplicate submissions (see [[goal-spec]] Idempotency).
- Show a clear loading/pending state while waiting on PayPal's approval flow and the subsequent capture — never assume success before the backend confirms it (PayPal's client-side `onApprove` callback firing is a hint that the buyer approved, not proof the payment was captured; the backend's capture response is authoritative).
- Never log or display full card numbers; mask any sensitive fields shown in the UI.
- Serve the app over HTTPS only; the payment page must not be embeddable in an iframe from another origin (clickjacking protection).
- Validate cart contents and totals against the backend response at checkout time rather than trusting only client-side totals.
- On error, show a generic user-facing message (e.g. "Payment failed, please try again") without leaking backend/gateway error internals.
- Load the PayPal SDK script only from PayPal's official domain (`www.paypal.com/sdk/js`); the client id in that URL is intentionally public — the client **secret** stays server-side only.
- Any `VITE_*` env var is bundled into the public JS at build time and is visible to anyone — never put secrets behind a `VITE_` prefix (see Deployment above). `VITE_PAYPAL_CLIENT_ID` is fine there because it isn't a secret; a hypothetical `VITE_PAYPAL_CLIENT_SECRET` never would be.

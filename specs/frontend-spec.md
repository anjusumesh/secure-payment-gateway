# Frontend Spec

## Overview
A React single-page app that lets a user browse a small catalog of sports items, build a cart, and complete a demo payment (Card, UPI, or Net Banking) through Razorpay's test/sandbox checkout, ending on a success or error page depending on the outcome.

## Tech Stack
- React (latest, with functional components + hooks)
- React Router for page navigation
- React Context (or Redux Toolkit if state grows beyond the cart) for shared state
- Axios (or `fetch`) for calling the NestJS backend ([[backend-spec]])
- Razorpay Checkout.js — the hosted checkout widget loaded on the Payment page to collect payment details
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
- **Right (order summary):** a fixed sidebar with "Total" heading, Sub-Total row, a full-width rounded **dark blue** "Check Out" button (in place of the mockup's red), and a "We Accept" row showing the actual supported methods — Card / UPI / Net Banking (Razorpay), not the mockup's PayPal/Stripe/Apple Pay icons. The mockup's **Delivery row is dropped** — delivery/shipping is out of scope (see [[goal-spec]]).

This same card-row pattern (thumbnail + name/code + price, on a white card with light-brown accents) carries over to the **Item List** page for consistency, minus the quantity stepper (replaced by a single "Add to Cart" button there).

## Deployment
- **Host:** Vercel, deploying the Vite production build (`vite build`) as a static site on Vercel's CDN.
- **Client-side routing:** React Router needs a SPA rewrite rule (`vercel.json` with a catch-all rewrite to `/index.html`, or Vercel's framework preset for Vite/SPA) so that a hard refresh/direct link on `/cart`, `/payment`, etc. doesn't 404.
- **Environment variables:** set in the Vercel project settings (not committed to the repo):
  - `VITE_API_BASE_URL` — the deployed NestJS backend's URL ([[backend-spec]]).
  - `VITE_RAZORPAY_KEY_ID` — Razorpay's public **test** key id (safe to expose client-side; the key **secret** never goes here or into any frontend code — see [[backend-spec]]).
- **HTTPS:** provided automatically by Vercel, satisfying the HTTPS-only requirement below.
- **Preview deployments:** every branch/PR gets its own Vercel preview URL. The backend's CORS allowlist ([[backend-spec]]) needs to account for these in addition to the production domain (e.g. allow the production domain plus a `*.vercel.app` pattern for this project during development).

## Pages / Screens
| Page | Purpose |
|---|---|
| **Item List** | Landing page. Shows the 5 sports items (name, image, price) with an "Add to Cart" button on each. |
| **Cart** | Two-column layout (see [Layout Reference](#layout-reference)): item rows with quantity stepper and line total on the left, an order summary sidebar with grand total and "Check Out" button on the right. |
| **Payment** | Requests a Razorpay order from the backend, then opens the Razorpay Checkout widget where the user picks a method (Card, UPI, Net Banking) and pays. |
| **Success** | Confirms the transaction completed, shows an order/transaction reference and amount paid. |
| **Error / Failure** | Shown when a transaction fails or is cancelled; explains the outcome and lets the user retry or return to the cart. |

## Components
- `ItemList` / `ItemCard` — renders the catalog and the "Add to Cart" action.
- `Cart` / `CartItem` — renders selected items, quantities, and running total (see [Layout Reference](#layout-reference)).
- `QuantityStepper` — the `− [qty] +` control used on each `CartItem` row.
- `OrderSummary` — the right-hand sidebar on the Cart page (Sub-Total, Check Out button, accepted-methods row — no delivery/shipping, out of scope).
- `Payment` — requests a Razorpay order from the backend and launches Razorpay Checkout.js.
- `PaymentSuccess` — success confirmation view.
- `PaymentError` — failure/cancellation view.
- `Header` — shared nav bar (e.g. cart item count).
- `CartContext` (+ `useCart` hook) — holds cart state and exposes add/remove/total logic to components.
- `paymentService` (plain module, not a component) — calls the backend to create a Razorpay order and to verify/fetch the final transaction status.

## State Management
- Cart state held client-side in `CartContext` (React Context + `useReducer`/`useState`), not persisted server-side until checkout begins.
- Transaction/payment status is authoritative on the backend ([[backend-spec]]); the frontend reads the status the backend returns (after Razorpay's callback/webhook updates it) rather than deciding success/failure itself.
- No sensitive payment data (card numbers, CVV) is ever held in React state or `localStorage` — those fields are entered directly into the Razorpay Checkout widget (hosted by Razorpay), never into this app's own form fields.

## UX / Security Considerations
- Disable the "Pay" button after first click to prevent duplicate submissions (see [[goal-spec]] Idempotency).
- Show a clear loading/pending state while waiting on the Razorpay response — never assume success before the backend confirms it (Razorpay's client-side "success" callback is a hint, not proof of payment; the backend's verified status is authoritative).
- Never log or display full card numbers; mask any sensitive fields shown in the UI.
- Serve the app over HTTPS only; the payment page must not be embeddable in an iframe from another origin (clickjacking protection).
- Validate cart contents and totals against the backend response at checkout time rather than trusting only client-side totals.
- On error, show a generic user-facing message (e.g. "Payment failed, please try again") without leaking backend/gateway error internals.
- Load `checkout.js` only from Razorpay's official CDN and pass only the publishable/test **key id** to the frontend — the **key secret** stays server-side only.
- Any `VITE_*` env var is bundled into the public JS at build time and is visible to anyone — never put secrets behind a `VITE_` prefix (see Deployment above).

# Implementation Roadmap

Companion to `specs/goal-spec.md`, `specs/backend-spec.md`, `specs/frontend-spec.md`, and `specs/api-contract.md`. This file sequences the work; `01-backend-plan.md`, `02-frontend-plan.md`, and `03-deployment-plan.md` hold the step-by-step detail for each phase.

**Build order:** backend before frontend. The frontend can't be meaningfully tested without real `/items` and `/payment/*` endpoints to call, and the payment flow's security-critical logic (server-side total calculation, signature verification) lives entirely in the backend.

**Assumed repo layout:** a single git repo (already initialized) with two subfolders, `backend/` and `frontend/`, each independently deployable.

## Phase 0 — Project & Account Setup
- Scaffold `backend/` (NestJS) and `frontend/` (Vite + React) subfolders.
- Create a MongoDB Atlas account + free M0 cluster.
- Create a Razorpay account, switch to **Test Mode**, generate a test Key Id/Secret.
- *(Detail: `03-deployment-plan.md` steps 1–2, done early so keys exist before Phase 2.)*

## Phase 1 — Backend Core (no payment yet)
- NestJS project wired to MongoDB Atlas via Mongoose.
- `ItemsModule`: schema, seed script for the 5 sports items, `GET /items`.
- `TransactionsModule`: schema, `GET /transactions`, `GET /transactions/:id`.
- Global validation pipe, exception filter, CORS scaffolding.
- **Milestone:** `GET /items` returns the seeded catalog; `GET /transactions` returns `[]`.
- *(Detail: `01-backend-plan.md` sections 1–3.)*

## Phase 2 — Payment Integration (Backend)
- `PaymentModule`: `POST /payment/create-order`, `POST /payment/verify`, `POST /payment/cancel`, `POST /payment/webhook`.
- Local webhook testing via a tunnel (e.g. ngrok) ahead of first deploy.
- **Milestone:** a Razorpay test-mode order can be created, paid (or failed) via a test card, and the resulting `Transaction` document correctly reaches `DONE`/`FAILED`, callable directly via curl/Postman without any frontend yet.
- *(Detail: `01-backend-plan.md` sections 4–7.)*

## Phase 3 — Frontend Core (no payment yet)
- Vite + React scaffold, routing, Fira Sans + color tokens from `frontend-spec.md` Visual Design.
- `CartContext`, Item List page, Cart page (per the Layout Reference two-column pattern).
- **Milestone:** a user can browse the 5 items, add/remove them from a cart, and see an accurate running total, wired to the real `GET /items` from Phase 1.
- *(Detail: `02-frontend-plan.md` sections 1–5.)*

## Phase 4 — Payment Integration (Frontend)
- `paymentService`, Payment page (Razorpay Checkout.js), Success/Error pages.
- Wire the full cart → create-order → Checkout.js → verify/cancel → success/error loop against the Phase 2 backend.
- **Milestone:** a complete end-to-end test transaction (success, failure, and cancel paths) works locally.
- *(Detail: `02-frontend-plan.md` sections 6–9.)*

## Phase 5 — Deployment
- MongoDB Atlas → Render (backend) → Razorpay webhook registration → Vercel (frontend) → tighten CORS to the real Vercel domain.
- **Milestone:** the same three paths (success/failure/cancel) work against the live, deployed URLs.
- *(Detail: `03-deployment-plan.md`.)*

## Phase 6 — Verify Against the Spec
Walk through `specs/goal-spec.md` Success Criteria one by one against the live deployment:
- [ ] Select items, add to cart, accurate running total.
- [ ] Successful test transaction completes and paid items are confirmed.
- [ ] Failed transaction handled gracefully, no amount captured.
- [ ] Every attempt recorded with correct status (`DONE`/`FAILED`/`CANCELLED`).
- [ ] Past transactions and their statuses are viewable.

Also re-check `frontend-spec.md`'s UX/Security and Accessibility notes, and `backend-spec.md`'s Security Requirements, against the actual running app before calling the demo done.

# Deployment Plan

Implements the Deployment sections of `specs/backend-spec.md` (Render + MongoDB Atlas) and `specs/frontend-spec.md` (Vercel). Covers roadmap Phase 5 (`plans/00-roadmap.md`). Do this after the backend (Phase 1–2) and frontend (Phase 3–4) both work locally.

## 1. MongoDB Atlas
- [ ] Create a free M0 cluster.
- [ ] Create a database user + password; copy the `mongodb+srv://...` connection string.
- [ ] Network access: for this demo, allow access from anywhere (`0.0.0.0/0`) rather than pinning Render's dynamic egress IPs — acceptable since no real financial data is stored (test-mode only, per `goal-spec.md` Out of Scope).

## 2. Razorpay
- [ ] Confirm the account is in **Test Mode**; note the Test Key Id/Secret (already used locally in `01-backend-plan.md`).
- [ ] Webhook URL + secret are configured in step 4, once the Render URL exists.

## 3. Backend → Render
- [ ] Push the `backend/` folder to the git repo (already done for earlier commits).
- [ ] Create a Render **Web Service** pointed at this repo (root directory `backend/` if using a monorepo).
- [ ] Build command: `npm install && npm run build`. Start command: `npm run start:prod`.
- [ ] Ensure the app listens on `process.env.PORT` (Render assigns this — don't hardcode a port).
- [ ] Set env vars in Render: `MONGODB_URI` (from step 1), `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and a temporary `CORS_ALLOWED_ORIGINS` (e.g. `http://localhost:5173`) to be tightened in step 6.
- [ ] Deploy; note the resulting `https://<service>.onrender.com` URL.
- [ ] Run the items seed script once (Render's shell, or a one-off local run against the Atlas `MONGODB_URI`) to populate the 5 sports items.

## 4. Razorpay Webhook
- [ ] In the Razorpay dashboard (Test Mode), add a webhook: URL `https://<service>.onrender.com/payment/webhook`, subscribed to `payment.captured` and `payment.failed`.
- [ ] Copy the webhook secret Razorpay generates into Render's `RAZORPAY_WEBHOOK_SECRET` env var; redeploy so it takes effect.

## 5. Frontend → Vercel
- [ ] Import the repo into Vercel (root directory `frontend/` if using a monorepo); framework preset "Vite".
- [ ] Set `VITE_API_BASE_URL` = the Render backend URL from step 3.
- [ ] Confirm the SPA rewrite is active (either `vercel.json`'s catch-all, or Vercel's own Vite/SPA handling) so direct links to `/cart`, `/payment`, etc. don't 404.
- [ ] Deploy; note the resulting `https://<project>.vercel.app` URL.

## 6. Close the Loop
- [ ] Update Render's `CORS_ALLOWED_ORIGINS` to the real Vercel production URL (add a `*.vercel.app` pattern too if preview-deployment testing is needed — see `frontend-spec.md` Deployment); redeploy the backend.
- [ ] Full smoke test against the **live** URLs: happy path, failure path, cancel path (same three checks as `02-frontend-plan.md` section 9).
- [ ] Note for later: Render's free tier spins down on inactivity, so the first request after idle may be slow — a known, acceptable limitation for this demo (`backend-spec.md` Deployment).

## 7. Final Verification
- [ ] Re-run `plans/00-roadmap.md` Phase 6's checklist against the live deployment before considering the project done.

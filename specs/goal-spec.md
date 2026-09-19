# Goal Spec

## Overview
Build a secure payment gateway demo and use it to learn the full payment-processing flow end to end in a full-stack application (React frontend, NestJS backend, MongoDB storage, integrated with Razorpay's test/sandbox mode).

## Objectives
- Provide a demo storefront UI listing 5 sports items that can be added to a cart.
- Let the user review the cart (selected items + total) and proceed to checkout.
- Integrate with Razorpay's test/sandbox mode to perform a demo transaction (card, UPI, or Net Banking).
- Handle both successful and failed transaction outcomes correctly.
- Persist transaction history for every attempted payment.

## Scope
A sample single-store checkout flow used to learn how a payment gateway integration works and how to secure it — not a production payment platform.

## Out of Scope
- Real/live payment processing (only test/sandbox gateway credentials are used).
- Refunds, partial refunds, and chargebacks.
- Multi-currency support.
- User accounts, registration, and login (unless added later as a stretch goal).
- Multi-item inventory management (stock levels, restocking, etc.).
- Delivery/shipping (no physical fulfillment; the Cart page shows a total to pay only — no delivery method or address step).
- Production-grade compliance (PCI-DSS certification, audit logging at scale, etc.) — security *practices* are still followed, but formal certification is out of scope.

## Success Criteria
- A user can select items, add them to a cart, and see an accurate running total.
- A successful test transaction completes and the paid items are confirmed.
- A failed transaction is handled gracefully and **does not deduct/capture any amount**.
- Every transaction attempt is recorded in transaction history with the correct status: `DONE`, `FAILED`, or `CANCELLED`.
- A user can view past transactions and their statuses.

## Glossary
| Term | Definition |
|---|---|
| **Cart** | The temporary, client-side collection of items a user has selected before checkout. |
| **Checkout** | The step where the user confirms the cart contents/total and proceeds to payment. |
| **Payment Gateway** | The third-party service (Razorpay) that securely handles card/payment details and authorizes or declines a transaction. |
| **Test/Sandbox Gateway** | Razorpay's non-production ("Test Mode") environment, using test API keys, which simulates real transactions without moving real money. |
| **Payment Method** | The channel used to pay — in this project: Card, UPI, or Net Banking (all supported by Razorpay's test mode). |
| **Transaction** | A single attempt to pay for a cart, tracked from initiation through to a final status. |
| **Transaction History** | The persisted record of all past transactions and their outcomes, stored in MongoDB. |
| **Transaction Status** | The outcome of a transaction: `DONE` (payment succeeded), `FAILED` (payment attempted but declined/errored), or `CANCELLED` (user abandoned before completion). |
| **Authorization** | The payment gateway's approval that funds are available/valid, prior to capture. |
| **Capture** | The step where an authorized amount is actually collected. A failed transaction must never reach capture. |
| **Webhook / Callback** | An asynchronous notification from the payment gateway to the backend confirming the final result of a transaction. |
| **Idempotency** | The property that retrying the same payment request (e.g. on network retry) does not create a duplicate charge or duplicate transaction record. |
| **API** | The NestJS backend's HTTP interface, called by the React frontend to manage cart, checkout, and transaction data. |
| **Razorpay Order** | A Razorpay-side record created by the backend before checkout, representing the amount to be collected; the frontend checkout widget is initialized against this order id. |

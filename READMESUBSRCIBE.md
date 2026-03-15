# Subscribe MVP Plan (Stripe + Supabase)

This version is intentionally optimized for speed so you can ship a test build to selected users ASAP.

## MVP outcome

Implement only what is required for a safe paid flow with one entitlement decision:

- Two paid plans: monthly and yearly.
- Both plans unlock the same full app access.
- One access decision only: active subscription vs not active.

## Keep vs defer

- This document: only MVP-now implementation steps.
- Deferred items: see READMEPOSTMVP.md.

## Current status in this repo

Already scaffolded:

- Subscribe screen exists and can trigger checkout intent.
- `create-checkout-session` edge function scaffold exists.
- Client mutation hook exists for checkout session creation.

Still required for MVP:

- Database billing tables + access helper.
- Webhook ingestion to update subscription state.
- App gating from real subscription state (not hardcoded).

## MVP steps (in order)

1. Stripe setup (test mode only)
- Create Stripe account in test mode.
- Create two recurring prices: monthly and yearly.
- Save both price IDs in app env:
  - `EXPO_PUBLIC_STRIPE_PRICE_ID_MONTHLY`
  - `EXPO_PUBLIC_STRIPE_PRICE_ID_YEARLY`
- Add Supabase function secret:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_WEBHOOK_SECRET`
- Define success/cancel return URLs for mobile deep links so checkout returns to the app predictably.

2. Add minimal billing schema in Supabase
- Create `billing_customers` table:
  - `user_id` (unique, maps to auth user)
  - `stripe_customer_id` (unique)
- Create `subscriptions` table:
  - `user_id`
  - `stripe_subscription_id` (unique)
  - `status`
  - `current_period_end`
  - timestamps
- Create `stripe_webhook_events` table for idempotency:
  - `event_id` (unique)
  - payload + processed timestamp
- Add helper SQL function:
  - `has_active_subscription(user_id)` returns boolean
  - true only for active/trialing and not expired

3. Add basic RLS for premium data
- Use `has_active_subscription(auth.uid())` in premium table read policies.
- Ensure non-premium data stays accessible as-is.

4. Finalize checkout session function
- Keep server-side allowlist mapping for valid `priceId` values.
- Require auth (`verify_jwt: true`).
- Attach `user_id` in Stripe session metadata so webhook processing can map events back to the correct app user.
- Return hosted Stripe checkout URL.

5. Add Stripe webhook function (MVP critical)
- Verify Stripe webhook signature.
- Process these events only for MVP:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- Upsert `billing_customers` + `subscriptions`.
- Insert `event_id` into `stripe_webhook_events` and skip duplicates.
- If metadata is missing on an event, resolve user via `stripe_customer_id` from `billing_customers` before updating entitlements.

6. Connect real entitlement to app
- Add `lib/hooks/useSubscriptionStatus.ts` (React Query).
- Replace hardcoded subscription booleans in Home and any other gate checks.
- Route-guard premium screens in private layouts:
  - inactive -> redirect to subscribe page
  - active -> allow access

7. Add purchase return refresh
- On return from checkout, invalidate/refetch subscription query.
- Optional short polling window (up to 30-60 seconds) while webhook settles.

8. MVP tester experience requirements
- Add clear states on subscribe screen:
  - loading
  - purchase processing
  - active
  - inactive
- Add basic error feedback for checkout/webhook lag (already using snackbar pattern).
- Add one internal support fallback:
  - documented SQL update path to manually fix a tester entitlement if webhook fails.

9. MVP test checklist (must pass before test build)
- New user with no subscription is blocked from premium route.
- Monthly subscriber gets access.
- Yearly subscriber gets access.
- Canceled subscriber loses access at period end.
- Direct premium data access is blocked by RLS for inactive users.
- Re-login preserves correct entitlement state.

10. Ship test build
- Deploy edge functions in test environment.
- Configure Stripe webhook endpoint to Supabase function.
- Run end-to-end test purchases with test cards.
- Validate mobile deep-link return from checkout success and cancel paths on real devices.
- Release test build to selected users.

## Definition of done for MVP

MVP is complete when all are true:

- No hardcoded subscription flag controls premium access.
- Stripe checkout can be launched for monthly/yearly plans.
- Webhook updates subscription state in DB reliably (idempotent).
- Premium routes and premium data are blocked for inactive users.
- Test users can purchase and unlock access end-to-end.

## Notes

If a requirement is not needed to unblock test users this week, move it to READMEPOSTMVP.md instead of expanding MVP scope.

# Subscribe and Feature-Gating Implementation Guide

This document expands the subscription rollout plan for this app (Expo + Supabase + React Query), with concrete steps, decisions, and validation points.

## Goal

Move from a hardcoded UI flag like `hasActiveSubscription` to a reliable production model where:

- subscription state is trusted and server-backed
- premium routes/features are gated consistently
- users get clear upgrade and renewal UX
- protected data is not accessible without entitlement

## Current app context

- Client state and data fetching use React Query hooks in `lib/hooks`.
- Auth is Supabase-based (`lib/auth.tsx`, `lib/supabase.ts`).
- Private routing is controlled in `app/(private)` layouts.
- Home currently uses a hardcoded subscription boolean in `app/(private)/home.tsx`.
- A subscription page scaffold exists at `app/(private)/subscribe.tsx`.

## Step 1: Define subscription source of truth in Supabase

### What to build

Create billing domain tables (or equivalent shape):

- `billing_customers`
- `subscriptions`
- optional: `subscription_prices`, `subscription_products`
- optional: `entitlements` view/function for simplified app checks

### Required fields to include

In `subscriptions`, include at minimum:

- `user_id` (uuid FK or mapped auth user)
- `provider_subscription_id`
- `status` (`active`, `trialing`, `past_due`, `canceled`, etc.)
- `current_period_end`
- `created_at`, `updated_at`

### Access rule definition

Decide one canonical access rule and use it everywhere.

Example:

- access granted when `status IN ('active', 'trialing')`
- and `current_period_end > now()` (or grace policy if desired)

### SQL helper

Create a single DB helper function, for example:

- `has_active_subscription(p_user_id uuid) returns boolean`

Use this function in both backend checks and RLS policies.

### Validation checklist

- Query returns true for active/trialing test users
- Query returns false for canceled/expired users
- Null/unknown users return false safely

## Step 2: Add server-side update path (webhook-driven)

### Why

Client-side updates are not trusted. Payment provider webhooks must update subscription rows.

### What to implement

- Supabase Edge Function to receive webhook events
- Verify webhook signatures
- Map provider events to `subscriptions` upserts
- Persist raw event ids for idempotency (prevent duplicate processing)

### Important behavior

- Never unlock premium access from client redirect alone
- Only webhook-updated DB state should grant access

### Validation checklist

- Duplicate webhook events do not double-update
- Subscription renewals extend `current_period_end`
- Cancellations and payment failures flip status correctly

## Step 3: Add DB-level protection (RLS / RPC guards)

### Why

Hiding UI elements is not security. The database must enforce premium restrictions.

### What to protect

Any premium table query or mutation related to dashboard-only value.

### How

- Add RLS policies that include `has_active_subscription(auth.uid())`
- For RPCs, guard inside SQL function body where needed

### Validation checklist

- Non-subscribed authenticated user cannot query premium data
- Subscribed user can query premium data
- Existing non-premium features remain unaffected

## Step 4: Create one client entitlement hook

### Why

You need one shared source in app code so Home, layouts, and components do not drift.

### Suggested hook

- `lib/hooks/useSubscriptionStatus.ts`

### Hook return shape

- `isActiveSubscription: boolean`
- `status: string | null`
- `currentPeriodEnd: string | null`
- `isLoading`
- `error`

### Implementation notes

- Use React Query (`useQuery`) with stable query key, e.g. `['subscriptionStatus', userId]`
- Resolve user id from auth context or Supabase auth session, same style as existing hooks
- Keep stale time moderate (for example 30-120 seconds)

### Validation checklist

- Hook resolves correctly on app launch
- Hook refreshes after sign-in/sign-out
- Hook handles missing row as inactive without crashing

## Step 5: Replace hardcoded home gating

### File

- `app/(private)/home.tsx`

### Changes

- Replace `const hasActiveSubscription = true` with hook-derived value
- Keep existing dual-card UX:
  - active card: workspace CTA
  - inactive card: subscribe CTA
- Add loading state placeholder to avoid flicker while entitlement is unknown

### Validation checklist

- Active user sees subscribed card
- Inactive user sees subscribe card
- No transient wrong-card flash during load

## Step 6: Add route-level gating for premium screens

### Files

- `app/(private)/_layout.tsx`
- optionally `app/(private)/(dashboard)/_layout.tsx`

### Behavior

- Authenticated + inactive subscription attempting premium routes => redirect to `/subscribe`
- Active subscription => allow premium navigation
- Keep non-premium screens available if product requires

### Important

- Do not trigger redirect loops
- Wait for subscription hook loading before deciding redirect

### Validation checklist

- Direct-link to premium route while inactive redirects properly
- Active users can open premium routes directly
- Back navigation remains stable

## Step 7: Connect subscribe page to checkout flow

### File

- `app/(private)/subscribe.tsx`

### Current

- Plan selection and cart placeholder are present

### Next

- Replace placeholder checkout button with network action:
  - call Edge Function to create checkout session
  - open returned checkout URL

### Security notes

- Do not generate checkout sessions directly in client with secrets
- Keep provider secret keys only in server-side environment

### Validation checklist

- Checkout URL opens correctly
- Failure states show clear snackbar/toast
- User can retry without app restart

### Project implementation status

This repository now includes:

- Client mutation hook: `lib/hooks/useCreateCheckoutSession.ts`
- Subscribe page wired to checkout URL opening: `app/(private)/subscribe.tsx`
- Supabase Edge Function scaffold: `supabase/functions/create-checkout-session/index.ts`

Required environment variables:

- On the mobile app:
  - `EXPO_PUBLIC_STRIPE_PRICE_ID_MONTHLY`
  - `EXPO_PUBLIC_STRIPE_PRICE_ID_YEARLY`
- On Supabase Edge Functions:
  - `STRIPE_SECRET_KEY`
  - `STRIPE_CHECKOUT_SUCCESS_URL` (optional if using app scheme fallback)
  - `STRIPE_CHECKOUT_CANCEL_URL` (optional if using app scheme fallback)

Deployment note:

- Deploy function with `verify_jwt` enabled so authenticated users can invoke checkout creation safely.

## Step 8: Refresh entitlement after purchase return

### Why

Webhook processing can be slightly delayed. App should re-check subscription state when user returns.

### What to do

- On app foreground and subscribe screen focus, invalidate `['subscriptionStatus', userId]`
- Optionally add a short polling window after checkout return (for example 20-60 seconds)

### Validation checklist

- User sees access unlock soon after successful purchase
- If webhook is delayed, UI shows "processing" state instead of stale inactive

## Step 9: Handle full state model (not only active/inactive)

### Recommended status mapping

- `trialing`: allow
- `active`: allow
- `past_due`: product decision (allow grace or block)
- `canceled`: block after period end
- `incomplete` / `incomplete_expired`: block

### UX recommendations

- Show state-specific messaging on subscribe page
- Add renewal CTA for lapsed users
- Avoid generic "not subscribed" text for all scenarios

## Step 10: Add observability and admin debugging

### Logging

- Log webhook processing outcome and failure reason
- Log session creation failures (without secrets)

### Useful admin queries

- by user id: current subscription row
- by provider id: latest status and period end
- recent webhook failures

### Validation checklist

- Can quickly diagnose why a user is blocked/unblocked
- Can distinguish data issue vs webhook delay vs auth mismatch

## Step 11: Production hardening checks

- Idempotency key for webhook event ids
- DB indexes on `user_id` and provider ids
- Transaction-safe upserts for subscription updates
- Retry strategy for transient webhook failures
- Safe defaults: unknown state should not grant premium access

## Step 12: Rollout strategy

### Suggested rollout

1. Merge DB schema + helper function + RLS
2. Deploy webhook and session creation function
3. Ship subscription status hook
4. Switch Home to hook-based card rendering
5. Enable route-level gating
6. Replace checkout placeholder

### Feature flag option

If needed, use a temporary client-side flag to enable gating for internal users first.

## Step 13: Testing matrix

Test each scenario end-to-end:

- new user with no subscription
- active monthly
- active yearly
- trialing
- canceled but still in paid period
- canceled and expired
- past_due

For each scenario verify:

- Home card correctness
- Route access behavior
- Data access restrictions (RLS)
- Subscribe page messaging and CTA

## Step 14: Project-specific file map

Primary files you will touch:

- `app/(private)/home.tsx`
- `app/(private)/_layout.tsx`
- `app/(private)/(dashboard)/_layout.tsx` (if dashboard-only gating)
- `app/(private)/subscribe.tsx`
- `lib/hooks/useSubscriptionStatus.ts` (new)
- `lib/queryClient.ts` (if query key defaults/invalidation helpers needed)
- `sql/...` migration files for tables/policies/functions

## Step 15: Definition of done

You are done when all are true:

- No hardcoded subscription booleans remain in feature gating
- Route-level gating works correctly for inactive users
- Protected data is blocked by DB policies
- Purchase flow updates entitlement via webhook
- Home and subscribe UX reflect real status consistently
- Tests/manual checks pass for all key states

---

If you want, the next implementation pass can be:

1. Create `useSubscriptionStatus` hook
2. Replace home hardcoded boolean
3. Add route redirect guard in private layout

That gives immediate value before payment gateway wiring is finalized.

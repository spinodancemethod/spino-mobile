Yes, you need a Stripe account.

What you already have now is the app-side and function-side plumbing. To make it actually work end-to-end, you still need the Stripe + Supabase setup pieces below.

Required to complete Stripe integration

Stripe account + products/prices
Create a Stripe account (test mode first).
Create subscription Products and recurring Prices:
Monthly price
Yearly price
Copy the Stripe Price IDs into app env:
EXPO_PUBLIC_STRIPE_PRICE_ID_MONTHLY
EXPO_PUBLIC_STRIPE_PRICE_ID_YEARLY
Stripe secret in Supabase Edge Functions
Add STRIPE_SECRET_KEY to Supabase function secrets.
Deploy the function after setting secrets.
Webhook endpoint (critical)
Create and deploy a Stripe webhook Edge Function (separate from checkout creation).
Configure Stripe webhook URL to that function.
Listen to key events:
checkout.session.completed
customer.subscription.created
customer.subscription.updated
customer.subscription.deleted
invoice.payment_failed (optional but recommended)
Store/update subscription status in your DB from webhook events.
Subscription schema in Supabase
Add tables or fields for:
stripe_customer_id
stripe_subscription_id
status
current_period_end
plan/price_id
Add indexes and idempotency handling for webhook event IDs.
Entitlement logic
Implement has_active_subscription(user_id) SQL function (or equivalent view).
Use this in:
app hook (UI decisions)
route gating
RLS for premium data (real enforcement)
Redirect URLs / deep links
Set STRIPE_CHECKOUT_SUCCESS_URL and STRIPE_CHECKOUT_CANCEL_URL in function env.
Ensure URLs/deep links return users back to app correctly.
Customer portal (recommended)
Add an endpoint/button for “Manage subscription” using Stripe Billing Portal.
This reduces support burden for cancellations/payment updates.
Test-mode validation pass
Use Stripe test cards and scenarios:
successful subscription
canceled subscription
payment failure
renewal update
Confirm your UI and DB status change correctly after webhook processing.
Direct answer

Yes, you need to create a Stripe account.
Without Stripe account + products + webhooks, checkout can open but subscription state won’t reliably update in your app/backend.
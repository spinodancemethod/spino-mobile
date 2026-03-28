# Features

## Current Product (Google Play Runtime)

- Trimmed this file into a release-focused artifact and moved legacy detail into a compact archive section.
- Removed Stripe-only bootstrap schema artifacts (`billing_customers`, `stripe_webhook_events`, Stripe-specific indexes/rls checks) so fresh bootstrap scripts match the Google Play-only runtime.
- Replaced remaining weak typing in `Components/ThemedPill.tsx` with typed theme-token narrowing and removed dynamic `any` casts.
- Cleared high-severity production dependency audit findings via `npm audit fix --omit=dev` (one moderate advisory remains).
- Hardened Google Play runtime paths: verification error sanitization, finalize-after-verify purchase flow, and restore throttling.
- Simplified release operations with dynamic Expo updates URL injection, legal URL env wiring, and Android release smoke CI.
- Maintained production access controls via subscription-backed entitlement guards in app UI and SQL bootstrap policies.

## Archived Stripe-Era Milestones

- Stripe checkout/webhook/cancel runtime paths were removed and billing was migrated to Google Play verification flows.
- The deprecated Supabase `create-checkout-session` Stripe edge function was removed as part of the Google Play-only runtime cutover.

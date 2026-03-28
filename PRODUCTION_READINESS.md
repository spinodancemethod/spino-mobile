# Production Readiness Checklist

## Billing and entitlement
- [ ] Google Play products exist for monthly and yearly plans.
- [ ] Supabase function `verify-google-play-purchase` is deployed with all required secrets.
- [ ] Dashboard access is gated by server-side entitlement checks.
- [ ] Restore purchases works from Account page on Android.

## Environment and secrets
- [ ] `.env.example` values are mirrored in production env config.
- [ ] No service keys, keystores, or private keys are committed.
- [ ] Android signing values (`SPINO_UPLOAD_*`) are configured outside git.

## Database and policies
- [ ] Billing migrations were applied and verified (`subscriptions`, `billing_events`, `billing_provider_accounts`).
- [ ] `has_active_subscription(uuid)` returns expected values for test users.
- [ ] RLS policies are enabled for billing tables and only allow intended reads.

## App quality gates
- [ ] `npm run typecheck` passes.
- [ ] `npm test` passes.
- [ ] Manual smoke test completed for login, dashboard, video playback, notes, favourites, deck, subscribe, restore.

## Operations
- [ ] Supabase function logs are monitored for purchase verification failures.
- [ ] Incident path exists for entitlement mismatch (support + manual verification process).
- [ ] Release notes capture billing and entitlement changes.

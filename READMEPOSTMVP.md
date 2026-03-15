# Post-MVP Backlog (Subscription + Billing)

These items are intentionally deferred so MVP can ship quickly to test users.

## Billing product expansion

- Plan-specific feature tiers/entitlements (instead of one shared full-access flag).
- Coupons, promo codes, intro offers, and free-trial experiments.
- Proration handling for mid-cycle plan switching UX.

## Self-serve account management

- Stripe Billing Portal integration in-app.
- Upgrade/downgrade flow with explicit effective-date messaging.
- In-app billing history and invoice/receipt surfaces.

## Reliability and operations hardening

- Scheduled Stripe-to-DB reconciliation job.
- Advanced alerting for webhook failures and stale entitlement sync.
- Admin dashboard for support to inspect entitlement and webhook history.
- Automated entitlement override workflows with expiry/audit UI.

## Compliance and legal hardening

- Full Terms/Privacy consent version tracking at checkout start.
- Regional tax strategy rollout and Stripe Tax finalization.
- Formal data retention/deletion runbook for billing artifacts.

## Platform/payment strategy expansion

- Production readiness for live Stripe keys and runbooks.
- Evaluate/implement app-store billing paths if distribution model requires it.
- Multi-environment deployment automation for billing functions and webhook URLs.

## Analytics and growth

- Conversion funnel analytics across subscribe -> checkout -> paid.
- Churn and failed-payment lifecycle messaging automation.
- Lifecycle experiments (win-back, grace period messaging).

## Security/performance extras

- Rate limiting hardening and abuse anomaly detection tuning.
- Broader server-side premium enforcement audits across all RPC/edge paths.
- Additional load and resilience tests for webhook burst handling.

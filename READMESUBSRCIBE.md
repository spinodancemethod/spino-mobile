# Subscribe MVP Plan (Google Play + Supabase)

## Outcome

Ship one Android-only paid flow where Google Play subscription purchases unlock app access.

## Implemented in repo

- Provider-neutral billing schema migration has been applied.
- `verify-google-play-purchase` Supabase function scaffold exists.

## Remaining implementation order

1. Configure Google Play products
- Create monthly and yearly subscriptions in Play Console.
- Set local env values:
  - `EXPO_PUBLIC_GOOGLE_PLAY_PRODUCT_ID_MONTHLY`
  - `EXPO_PUBLIC_GOOGLE_PLAY_PRODUCT_ID_YEARLY`
  - `EXPO_PUBLIC_GOOGLE_PLAY_ANDROID_PACKAGE_NAME`
- Set function secrets:
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL`
  - `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY`
  - `GOOGLE_PLAY_ANDROID_PACKAGE_NAME`

2. Purchase flow
- Trigger Google Play purchase directly in app.
- Send purchase token to `verify-google-play-purchase`.
- Upsert entitlement in `subscriptions` with `provider='google_play'`.

3. Entitlement checks
- Query Google Play rows from `subscriptions`.
- Gate paid screens/features using active status + non-expired `current_period_end`.

4. Restore purchases
- Add restore action to fetch available purchases and verify each token.

5. Tester checklist
- Monthly purchase unlocks premium access.
- Yearly purchase unlocks premium access.
- Reinstall and restore works.
- Expired/canceled subscriptions lose access.

## Definition of done

- No Stripe checkout, Stripe cancel API, or Stripe webhook is required for paid access.
- Android users can subscribe through Google Play and immediately unlock content.
- Access state persists correctly across login/device/app restarts.

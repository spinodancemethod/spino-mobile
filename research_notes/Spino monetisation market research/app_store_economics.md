# App Store Economics and Subscription Benchmarks for a Small UK Indie Subscription App (Spino)

Research date: 14 Nov 2026. Most sources are vendor blogs (Adapty, Funnelfox, RevenueCat) plus Google's own Help Center. Apple's own fee documentation was not fetched directly. Dated figures and estimates are flagged inline.

## 1. Store fees in 2026 (Google Play, Apple, DMA / Epic / CMA, external links, web checkout)

### Takeaway
On Google Play in the UK/US/EEA, an auto-renewing subscription costs **15% all-in on Google Play Billing** (10% service fee plus 5% billing fee). Since 30 June 2026 you can also use alternative billing or a web link-out for **10% plus your processor's fee**. Apple's Small Business Program and the rate for subscriptions after year one are still **15%**. US link-outs currently pay Apple **0%**, pending court approval of new rates. In the UK, the CMA's steering rules are still pending, so UK iOS developers pay the standard 15–30%.

### Cited Findings
**Google Play (official Help Center, current page)**
- Rollout dates for the new fee structure: **30 June 2026** for the EEA, UK and US, and **30 Sept 2026** for Australia and Japan. Installs before the rollout date count as "existing" and later ones as "new". — [Google Play Console Help: service fees](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- Auto-renewing subscriptions in the US/UK/EEA/AU/JP pay a **10% service fee plus a 5% billing fee on the first $1M (USD) of annual earnings**, for both new and existing installs. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- One-time purchases on new installs pay 20% plus the 5% billing fee as standard, or 15% plus 5% for program participants. On existing installs they pay 25% plus 5%, or 20% via an external web link. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- The 5% billing fee applies only when the purchase goes through Google Play Billing. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- Other markets keep the old model until the global rollout: 15% on the first $1M then 30% above it, and **15% on auto-renewing subscriptions regardless of revenue**. — [Google Play Console Help](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)
- Adapty's summary of the change:
  - Google split the service fee from the billing fee. Google Play Billing totals 15%, "the same rate in place since January 2022".
  - Alternative billing or a web link costs a 10% service fee, 0% billing fee, plus your processor's cut.
  - Subscriptions pay 10% "on every tier and install type".
  - The global rollout is scheduled for **September 2027**, with Australia, Japan and Korea expected around the end of 2026.
  - Leaving Google billing saves money only if your processor costs under 5%. A fixed per-transaction fee can wipe out the saving on a ~$10 monthly plan, but not on a ~$100 annual plan. — [Adapty](https://adapty.io/blog/google-play-billing-changes-subscriptions-fees/)
- Background: the Epic v Google settlement and the policy changes date from March 2026. — [Help Net Security, Mar 2026](https://www.helpnetsecurity.com/2026/03/05/google-play-store-changes-android-app-distribution/)
- Conflict: some secondary sources describe the new subscription rate as simply "10%". Google's own page shows 10% service fee plus 5% billing fee when Play Billing is used. — [LaunchShots](https://launchshots.app/blog/google-play-15-percent-service-fee-2026) vs [Google](https://support.google.com/googleplay/android-developer/answer/112622?hl=en)

**Apple (secondary source: Funnelfox vendor blog; not checked against Apple's own docs)**
- Small Business Program: 15% on In-App Purchase. Auto-renewing subscriptions after the first year: 15%. — [Funnelfox](https://blog.funnelfox.com/apple-app-store-fees-2026-eu-dma/)
- EU DMA terms effective **1 Oct 2026**:
  - The Core Technology Fee, Initial Acquisition Fee and Store Services Fee are replaced by a single rate per payment path.
  - App Store IAP: 26% standard / 15% reduced.
  - Alternative in-app processing: 20% / 10%.
  - Link-out to your own checkout: 15% / 10%.
  - Alternative marketplace or web distribution: 5% Core Technology Commission. — [Funnelfox](https://blog.funnelfox.com/apple-app-store-fees-2026-eu-dma/)
- US: since April 2025, external payment links carry **no Apple commission** (Epic v Apple).
  - The Ninth Circuit upheld the contempt finding but allowed a cost-based commission in future.
  - On 14 Aug 2026 Apple asked the district court to approve 15% standard, 10% for partner programs and **5% for Small Business Program members** on link-outs. These rates cannot be charged until the court approves them.
  - The Supreme Court took up a narrow contempt question (June 30). — [Funnelfox](https://blog.funnelfox.com/apple-app-store-fees-2026-eu-dma/)
- UK:
  - Apple was designated with Strategic Market Status in October 2025. The first CMA commitments took effect on 1 Apr 2026 but do not touch commission. — [Funnelfox](https://blog.funnelfox.com/apple-app-store-fees-2026-eu-dma/)
  - The CMA proposed steering conduct requirements on 30 June 2026 and the consultation closed on 28 July 2026. Any steering fee must be "fair and reasonable" and below current commission. No number has been set and a decision is expected in late 2026. — [CMA consultation doc](https://assets.publishing.service.gov.uk/media/6a42a56a3413112faed80e26/Consultation_document__Apple_steering_.pdf); [MacRumors, Jul 2026](https://www.macrumors.com/2026/07/29/app-store-uk-rules-highly-intrusive/)
  - Apple calls the proposals "highly intrusive" price regulation. — [MacRumors](https://www.macrumors.com/2026/07/29/app-store-uk-rules-highly-intrusive/)

**Web checkout (RevenueCat Web Billing / Stripe)**
- Web Billing charges **Stripe's standard processing fee** (example given: 2.9% + $0.30 in the US) **plus the regular RevenueCat fee** (1% above $2.5k MTR). — [RevenueCat Billing announcement](https://www.revenuecat.com/blog/company/introducing-revenuecat-billing)

### Inferences
- On Android, for Spino's revenue scale, Play Billing costs 15% and a web link-out costs 10% plus Stripe (about 1.5% + 20p on UK cards; see gaps).
  - On a £4.99 monthly plan, the fixed 20p alone is about 4%, so link-out saves very little.
  - On a £39.99 annual plan, link-out saves roughly 3–4 percentage points.
  - Link-out also brings app-switch friction and makes you responsible for VAT compliance. **Recommendation: launch with Play Billing; revisit web checkout for annual plans later.**
- On iOS later, UK users will be at 15% (Small Business Program) unless the CMA's steering decision lands. US users can be linked out to the web for 0% today, but this may change to 5% for small businesses.

### Gaps
- Apple's own fee pages were not fetched directly, so Apple rates come from a vendor blog. Verify them on developer.apple.com.
- Stripe UK pricing (believed to be 1.5% + 20p for standard UK cards, with higher rates for EU and international cards) is from prior knowledge and was not verified this session.
- Google's exact rate for subscriptions above $1M under the new model was not clear. It is irrelevant at Spino's scale.
- The CMA's final steering decision and fee level are unknown as of Nov 2026.

## 2. UK VAT handling and net revenue per £4.99 subscription

### Takeaway
Both stores act as the VAT-collecting party for UK consumer sales: you set a VAT-inclusive price and receive a net payout. **A £4.99/month subscription nets about £3.53–£3.54** at a 15% fee (my calculation). Over 12 months that is about **£42.40/year**. A £39.99 annual plan nets about **£28.30**.

### Cited Findings
- "Apple applies VAT to the post-commission revenue from a transaction, while Google applies VAT to the full amount." RevenueCat's reporting changed in June 2024 to deduct taxes first, and it notes that proceeds are unaffected by the ordering. — [RevenueCat docs: Taxes and commissions](https://revenuecat.com/docs/dashboard-and-metrics/taxes-and-commissions)
- For most countries, Google collects and remits VAT. This comes from a 2022 forum thread, so it is dated. — [AccountingWEB](https://www.accountingweb.co.uk/any-answers/vat-treatment-for-google-app-sales)
- Developers set tax treatment in the Play Console "Tax and compliance" section. — [Google Play Help](https://support.google.com/googleplay/android-developer/answer/10463498)

### Inferences (my arithmetic, assuming 20% UK VAT is included in the consumer price and a 15% fee on the ex-VAT price)
- Monthly plan: £4.99 incl. VAT → VAT £0.83 → ex-VAT £4.16 → 15% fee £0.62 → **net ≈ £3.53/month (≈71% of sticker)**.
- Under a 10% fee (link-out, before Stripe fees): ≈ £3.74.
- £3.99/month nets ≈ £2.83. £2.99/month nets ≈ £2.12.
- Annual plan: £39.99/yr nets ≈ £28.32. £29.99/yr nets ≈ £21.24.
- RevenueCat takes nothing below $2.5k MTR. Above that it takes 1% of gross tracked revenue.
- With web checkout, the developer becomes the seller and must handle VAT. UK digital sales below the £90k UK VAT threshold may not need registration, but EU consumer sales need VAT OSS registration from the first sale. This is from general knowledge, not verified this session.

### Gaps
- Apple's exact UK proceeds table for the £4.99 price point was not retrieved.
- No official 2026 Google page on UK VAT computation was fetched.

## 3. Regional / tiered pricing and typical price points

### Takeaway
Apple offers 900 price points with automatic equalization across ~175 storefronts. Google Play takes free-form per-country prices. Median subscription prices for Education and Health & Fitness are **~$9.99/month and ~$40–45/year**, so a **£4.99/month, £29.99–£39.99/year** plan is below the category median.

### Cited Findings
- Apple supports up to 900 price points and auto-equalizes a base price across storefronts using FX and tax, with per-market overrides. — [Apple Developer News](https://developer.apple.com/news?id=dbrszv62); [Apple Newsroom, Dec 2022](https://www.apple.com/newsroom/2022/12/apple-announces-biggest-upgrade-to-app-store-pricing-adding-700-new-price-points/)
- Google Play takes free-form local prices per currency, subject to minimums. Pricing Templates were reportedly removed on 27 Oct 2025. This is from a single third-party source and was not confirmed by Google. — [PricePush](https://pricepush.app/blog/google-play-iap-pricing-by-country)
- RevenueCat SOSA 2026 median prices:
  - Monthly: ~$10 overall (the report also cites a rise from $7 to $8, which is an internal inconsistency).
  - Yearly: **$34.80** (up from $31.60). Weekly: $5.99.
  - **Education: $9.99/month, $44.99/year. Health & Fitness: $9.99/month, ~$39.94/year.**
  - By region: North America $9.99/month and $39.99/year; India/SE Asia $3.75/month and $18.32/year. — [RevenueCat State of Subscription Apps 2026](https://www.revenuecat.com/state-of-subscription-apps)

### Inferences
- Dance learners are mostly in Western markets. Purchasing-power pricing (around 40–60% of the UK price) is worth applying in LatAm, India and SE Asia, where the medians are about 40% of North America's.
- Typical GBP ladder: £2.99 / £3.99 / £4.99 monthly and £24.99 / £29.99 / £39.99 annual. An annual price around 6–8× monthly is the common "~40–50% off" framing. This is industry convention and not specifically sourced.

### Gaps
- No sourced data on GBP-specific price-point conversion differences.
- No purchasing-power index specific to Play was sourced.

## 4. Subscription benchmarks (conversion, paywall model, retention, refunds, categories, Android vs iOS, RPI)

### Takeaway
The median app converts only **~2% of downloads to paid with freemium, versus ~10.7% with a hard paywall**. Education download→trial is ~6.5% and Health & Fitness download→paid ~2.9%. Median D60 revenue per install is $0.34 overall ($0.66 H&F, $0.30 Education D14). Only **17.3% of new apps reach $1k/month** in revenue within two years. Google Play loses far more subscribers to billing failures (31% vs 14% of cancellations).

### Cited Findings (RevenueCat SOSA 2026: 115k+ apps, $16B revenue, published 19 Mar 2026)
- Hard paywall vs freemium:
  - Median D35 download→paid: **hard paywall 10.7%** (12.1% in 2025) vs **freemium 2.1%**. — [RevenueCat blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
  - RPI at D60: hard paywall **$3.09** vs freemium **$0.38**. At D14: $2.32 vs $0.27.
  - One-year retention of yearly subscribers is similar: freemium 28%, hard paywall 27%. — [RevenueCat blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026); [SOSA](https://www.revenuecat.com/state-of-subscription-apps)
- D30 download→trial by category: Business 9.1%, **Health & Fitness 6.9%, Education 6.5%**, Utilities 6.5%, Gaming 4.4%. — [SOSA](https://www.revenuecat.com/state-of-subscription-apps)
- D35 download→paid by category: **Health & Fitness 2.9%**, Business 2.6%, Gaming 1.0%. Education was not stated. — [SOSA](https://www.revenuecat.com/state-of-subscription-apps)
- Trial→paid:
  - By category: **Health & Fitness 37.7%**, Travel 43.5%, Gaming 25.0%.
  - By trial length: 17–32 days **42.5%**, 5–9 days 37.4%, ≤4 days 25.5%.
  - 46.5% of apps use trials of 4 days or less. — [SOSA](https://www.revenuecat.com/state-of-subscription-apps)
- Regional figures:
  - Download→trial: North America 7.1%, Western Europe 5.0%.
  - Trial→paid: North America 34.2%, Western Europe 29.7%, India/SE Asia 15.2%.
  - Download→paid: North America 2.6–2.8%, Western Europe 2.0%. — [SOSA](https://www.revenuecat.com/state-of-subscription-apps)
- RPI medians:
  - D14: overall $0.23; H&F $0.48; **Education $0.30**.
  - D60: overall $0.34; H&F $0.66.
  - D60 by region: North America $0.55, Europe $0.33. — [SOSA](https://www.revenuecat.com/state-of-subscription-apps)
- Revenue milestones for apps in their first two years:
  - **17.3% reach $1k monthly revenue** (median 58 days to get there).
  - 4.6% reach $10k. — [SOSA](https://www.revenuecat.com/state-of-subscription-apps)
- Top 5% of apps earn ~400× the bottom 25%. Median YoY MRR growth is ~5–15%. — [RevenueCat blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- Annual plans:
  - Month 1 accounts for 35% of annual cancellations.
  - About 72% of annual subscribers had cancelled auto-renew by the end of year 1 in 2026 (about 56% in 2025).
  - 55.4% of 3-day-trial cancellations happen on Day 0. — [RevenueCat blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
- Android vs iOS:
  - Billing failures cause **31% of Google Play cancellations vs 14% on the App Store**.
  - For AI apps in 2025, 12-month payer retention was 9.2% on the App Store and 11.5% on Google Play. — [RevenueCat blog](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026)
  - Trial conversion is reported as "nearly identical" across stores (App Store 32.6%). The Google Play figure was cut off in the snippet. — [search snippet of SOSA](https://www.revenuecat.com/state-of-subscription-apps)
- Adapty 2026 report (16k+ apps, $3B revenue):
  - Headline funnel: install→trial 27.8%, trial→paid 59.2%, first renewal 45.1%. The definitions are unclear, and these figures appear to be on a different basis from RevenueCat's.
  - In Education, 23.5% of trials start 31+ days after install. — [Adapty SOIS 2026](https://adapty.io/state-of-in-app-subscriptions-report/)
- Refunds:
  - Typical refund rate is 2–5% of paid transactions. Education and fitness tend to run higher (buyer's remorse). — [Adapty refund benchmarks](https://adapty.io/blog/refund-rate-metrics-and-benchmarking/)
  - Median refund rate is 2.71%. This is from an older Adapty guide and is undated. — [Adapty refund guide PDF](https://uploads.adapty.io/the_guide_on_managing_refunds_for_subscription_apps.pdf)

### Inferences
- Illustrative planning maths for Spino (freemium, Education/H&F-like):
  - 1,000 installs × ~2% paid ≈ 20 subscribers.
  - At ~£3.53 net per month that is ≈ £70 MRR.
  - D60 RPI of roughly $0.30–0.66 means 1,000 installs ≈ £230–£500 in the first two months.
- A ~£5 price ceiling against $9.99 category medians means Spino needs more volume, or more annual-plan uptake, to match median revenue.
- Google Play's high involuntary churn makes grace periods and account hold (configurable in Play Console and supported by RevenueCat) important for an Android-first launch.

### Gaps
- Benchmarks not found:
  - Education-specific trial→paid or download→paid on RevenueCat.
  - Monthly vs annual 12-month retention as separate numbers.
  - Refund rates by store.
  - A clean Android vs iOS trial→paid split.
- RevenueCat has a dedicated Education report at [revenuecat.com/state-of-subscription-apps-2026-education](https://www.revenuecat.com/state-of-subscription-apps-2026-education) that was not fetched and is worth checking.
- Purchasely benchmarks were not reviewed.

## 5. RevenueCat pricing for small apps

### Takeaway
RevenueCat is **free until $2,500 monthly tracked revenue (MTR)**, then charges **1% of all tracked revenue**. Web Billing adds Stripe's fees on top.

### Cited Findings
- "Pay nothing for up to $2,500 in monthly tracked revenue", then 1% of what you track. — [RevenueCat pricing](https://revenuecat.com/pricing)
- Third-party guides say the 1% applies to all MTR once you cross the threshold, for example $25 at $2,500. — [Costbench](https://www.costbench.com/software/subscription-billing/revenuecat/hidden-costs/)
- An aggregator listing a "$12/month Pro" plan conflicts with the official page. Treat it as unreliable. — [Costbench](https://costbench.com/compare/revenuecat-vs-stripe-billing/)

### Inferences
- $2,500 MTR is roughly £1,950/month gross, or about 700 monthly subscribers at £4.99 incl. VAT (MTR is likely measured on gross revenue). Spino will probably sit in the free tier for a long time.

### Gaps
- Whether MTR is measured gross or net of store fees and VAT was not confirmed this session.

## 6. Promo/offer codes (schools, students) and family sharing

### Takeaway
Google Play supports subscription promo codes. You get **up to 10,000 one-time codes per quarter per subscription**, or custom codes with 2,000–99,999 redemptions. Apple offer codes reportedly allow up to 1M redemptions per quarter. That is enough for school or class handouts. Family sharing for subscriptions is opt-in on both stores, but current Play subscription support is unverified.

### Cited Findings
- Google Play subscription promotions allow up to **10,000 one-time-use codes per quarter per subscription product**. Custom codes take a redemption limit between 2,000 and 99,999. Non-subscription promos are capped at 500 per quarter. — [Google Play Help: Create promotions](https://support.google.com/googleplay/android-developer/answer/6321495?hl=en); [Android Developers: Promo codes](https://developer.android.com/google/play/billing/promo)
- Apple subscription offer codes allow up to 1,000,000 redemptions per app per quarter (secondhand, not seen on Apple's own docs). Apple's legacy promo codes are limited to 100 per app version. — [Built by Foundry](https://www.builtbyfoundry.io/blog/how-many-free-app-codes-2026-100-25000-1-million)
- RevenueCat documents support for Google Play offers. — [RevenueCat docs: Google Play offers](https://www.revenuecat.com/docs/subscription-guidance/subscription-offers/google-play-offers)
- Google Play Family Library (2016) lets up to 6 members share purchases if the developer opts in, and the opt-in cannot be reversed. — [Google blog, 2016](https://blog.google/products/google-play/google-play-family-library-share-what/); [MacRumors 2016](https://www.macrumors.com/2016/07/28/google-play-family-library-sharing)
- Conflict: one 2016 report says Family Library excludes in-app purchases. A non-authoritative glossary says subscriptions can be opted in per product. — [BetaNews](https://betanews.com/article/google-play-family-library-app-game-sharing) vs [mwm.ai](https://mwm.ai/glossary/family-sharing)

### Inferences
- Schools: generate a Play custom code (for example "SCHOOL2026", one free month to a year depending on the offer) or batches of one-time codes for each class.
- Promo codes redeem through the store account, so students need their own Google account. Under-13s may be blocked by store account rules.
- A cleaner B2B option is server-side entitlements: grant access via a Supabase flag or RevenueCat promotional entitlements tied to a school licence invoiced directly. This sits outside store fees because it is not an in-app digital purchase. Verify policy compliance.
- Family sharing reduces revenue per household. It is probably not worth enabling at launch.

### Gaps
- Not verified from official sources:
  - Apple's current offer-code limits.
  - Whether Google Play Family Library currently supports auto-renewing subscriptions.
- Policy specifics on selling school licences outside the store were not researched.

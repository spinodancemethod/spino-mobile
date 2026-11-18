# Monetisation models for a niche hobby/learning app (Spino), with focus on B2B2C via instructors and schools

Research date: 2026-11-14. Many figures come from secondary sources, app-store listings or vendor blogs. Each one is flagged where that applies. Prices are USD unless stated otherwise.

## 1. Freemium vs hard paywall vs free trial; which free-tier gates work

### Takeaway
On RevenueCat's large dataset, hard paywalls convert about 5x better than freemium (10.7% vs 2.1% median) and earn about 8x more revenue per install, while 1-year retention is about the same. Longer trials (17–32 days) convert about 70% better than trials under 4 days. Freemium makes most sense when growth comes from word of mouth, network effects or user-generated content. That last case applies to Spino if instructors and schools act as the distribution channel.

### Cited Findings
- Download-to-paid conversion by Day 35: hard paywall median 10.7% vs freemium 2.1% (2026). Hard paywall fell from 12.1% in 2025; freemium stayed flat at 2.1% — [RevenueCat, Subscription app trends & benchmarks 2026](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026.md)
- Revenue per install at Day 60: $3.09 for hard paywall vs $0.38 for freemium (about 8x) — [RevenueCat 2026 benchmarks](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026.md)
- 1-year retention on annual plans: freemium 28% vs hard paywall 27%, which is negligible — [RevenueCat 2026 benchmarks](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026.md)
- The bottom quartile of hard-paywall apps (4.2%) still converts about double the freemium median — [RevenueCat, Hard paywall vs freemium](https://www.revenuecat.com/blog/growth/hard-paywall-vs-freemium.md)
- 2025 secondary figures: Year-1 LTV per payer $49.30 (hard) vs $24.24 (freemium); refund rates 5.8% (hard) vs 3.4% (freemium). These come from a secondary write-up and were not verified against the primary report — [Airbridge summary](https://www.airbridge.io/en/blog/hard-paywall-vs-freemium-2026)
- RevenueCat case studies cut both ways. One app saw LTV per user rise 75% after a multistep paywall that framed the app as "free forever, with a 7-day chance to try the best version". Another saw conversion fall more than 50% after a similar switch and reverted within weeks — [RevenueCat, Hard paywall vs freemium](https://www.revenuecat.com/blog/growth/hard-paywall-vs-freemium.md)
- RevenueCat says freemium suits apps with strong product-market fit and retention, network effects or user-generated content, and a need for organic or word-of-mouth growth. A hard paywall suits bootstrapped apps that need quick cash, apps solving an acute problem rather than building a habit, and teams without the analytics to test gating — [RevenueCat](https://www.revenuecat.com/blog/growth/hard-paywall-vs-freemium.md)
- Trial length: 17–32 day trials have a 42.5% median trial-to-paid rate, vs 25.5% for trials under 4 days. Even so, 46.5% of apps now use trials under 4 days. 55.4% of 3-day-trial cancellations happen on Day 0 — [RevenueCat 2026 benchmarks](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026.md)
- Comparable coaching and video apps use a "free for the student or athlete, paid by the coach" model. CoachNow says "we will never charge you on a per-athlete basis… your athletes NEVER PAY A DIME" — [CoachNow free trial page](https://coachnow.io/freetrialreferral). Onform says "athletes pay no fee to use the app with you", and its individual plans are $9.99 and $14.99 a month — [Onform App Store listing](https://apps.apple.com/us/app/id1490334045)

### Inferences
- Spino's job is habit-forming organisation (roadmaps, snippets) rather than solving an acute problem, and it can spread through schools. That favours freemium or a "free forever plus long trial of premium" hybrid over a hard paywall. A hard paywall would probably conflict with instructor-led distribution, because a teacher can't easily tell a whole class to download an app that charges on first open.
- Gates that fit Spino and keep the core habit free could include: a cap on the number of roadmaps (for example 1–2) or positions or snippets; making auto-cut of class recaps (the 8-count audio feature) the premium "magic" feature; and limits on exports, sharing or cross-device sync. These are inferences. No source gave dance-specific gating data.
- Because processing costs Spino under $0.01 per video, a generous free tier is cheap to run. A 14–30 day trial of premium is supported by the trial-length data above.

### Gaps
- No published conversion benchmarks for Education or Health & Fitness niche apps specifically. The full SOSA 2026 report has category cuts, but they weren't accessible here.
- No source quantified which free-tier limits (count caps vs feature gates) convert best for organiser or tracker apps.

## 2. Monthly vs annual vs lifetime pricing

### Takeaway
Offer monthly plus annual, with annual as the anchor. Lifetime is common in Education and Photo & Video and suits apps with very low marginal cost like Spino, typically priced at 2–12x annual. Indie apps usually sit around 3–5x. Annual plans have heavy cancellation in the first month and at renewal.

### Cited Findings
- Lifetime-to-annual multiples seen in the wild: Moonly 2.1x ($28.98/$59.98), Fiit 3.1x (£119.99/£375), Placify 3.3x, Jumpspeak 3.6x ($69/$249), Calm 5.0x ($79/$399), Waking Up 11.5x ($129.99/$1,500) — [RevenueCat, Lifetime subscriptions](https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md)
- RevenueCat says lifetime fits best when per-user ongoing cost is low, upfront cash is needed, retention is weak or uncertain, and upsells aren't central. Photo & Video, Education and Travel have the most lifetime adoption. In most other categories, about 18–24% of apps offer both subscription and lifetime — [RevenueCat](https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md)
- Lifetime risks: it cannibalises loyal high-LTV subscribers, makes price rises and upsells hard, and costs (for example AI) can outgrow one-off revenue. On the App Store, lifetime is a non-consumable, so it can't have a free trial — [RevenueCat](https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md)
- RevenueCat suggests 5–12x annual, set just above expected LTV — [RevenueCat via search summary](https://revenuecat.com/blog/growth/lifetime-subscriptions). A vendor blog suggests about 3–5x for indie apps, and notes indie apps often charge "low single digits to ~$10/month" — [Pricepush (vendor)](https://pricepush.app/blog/how-to-price-an-app)
- Using lifetime tactically: Fiit sends lifetime offers by email as win-backs, and Origin gives lifetime access for referring 3 friends — [RevenueCat](https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md)
- Annual churn pattern: Month 1 accounts for 35% of annual cancellations, then 3–10% per month mid-year, with a spike in Month 12. Year-1 cancellation of annuals was about 72% in 2026, up from about 56% — [RevenueCat 2026 benchmarks](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026.md)
- RevenueCat (2024) says offering only an annual plan usually yields less long-term revenue, even counting its better retention. The exception is apps that are especially exposed to seasonality — [RevenueCat SOSA 2024](https://www-docs.revenuecat.com/state-of-subscription-apps-2024/)
- Involuntary churn from billing failures is 31% of cancellations on Google Play and 14% on the App Store — [RevenueCat 2026 benchmarks](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026.md)
- Dance comparator STEEZY lists $99.99/yr on iOS and $149.99/yr on Google Play. Adapty's paywall library lists monthly tiers at $9.99, $19.99 and $29.99, which may be outdated — [App Store](https://apps.apple.com/us/app/-/id1296001664); [Adapty paywall library](https://adapty.io/paywall-library/steezy/)

### Inferences
- With a consumer ceiling of about £5/month, a plausible structure is £4.99/month, £29.99–£39.99/year (a 33–50% saving, which anchors on annual), and optionally lifetime at about £79–£119 (about 3x annual). Lifetime could be kept as a launch, festival or win-back offer rather than permanently on the paywall. These figures are an inference, not sourced.
- Spino's near-zero marginal cost removes the main lifetime risk (costs outgrowing revenue). The remaining risk is cannibalisation.

### Gaps
- No UK-specific price-point benchmarks for Education or Lifestyle apps were found.
- No data on what share of revenue comes from lifetime in small indie apps.

## 3. B2B2C and school licensing: how comparable platforms price seats

### Takeaway
In sports, music and coaching, platforms almost always charge the coach or organisation and keep the student or athlete free. Pricing is per coach seat (about $20–60/month), per team per year (Hudl $400–3,300), or per studio. Academies and bulk buyers get custom quotes. Studio management and video platforms with branded apps cost $49–$499+/month.

### Cited Findings
- CoachNow: free tier, then CoachNow+ at $24.99 per coach per month billed annually (per G2 and Capterra). There are no per-athlete fees, and bulk or academy pricing is by custom quote via support. Its "Organizations" offering promises exclusive pricing, AI video analysis and "free athlete transfers" after an application — [G2](https://g2.com/products/coachnow/pricing); [Capterra](https://www.capterra.com/p/196441/CoachNow/); [CoachNow help](https://help.coachnow.io/en/articles/6346801-i-ve-got-multiple-coaches-on-my-account-and-or-i-am-interested-in-adding-additional-coaches-what-should-i-do); [CoachNow orgs](https://coachnow.io/organizationsb); [free trial page](https://coachnow.io/freetrialreferral)
- Onform: Coach Basic $19.99, Standard $39.99 and Pro $59.99 per month, with unlimited clients and discounted yearly and quarterly plans. Athletes pay nothing when linked to a coach. Listings are inconsistent; an older one shows $29.99/month for 1 coach with unlimited athletes — [Onform App Store](https://apps.apple.com/us/app/id1490334045)
- Hudl (team video): Club Bronze $400, Silver $1,000 and Gold $1,600 per team per year. High school Silver $900, Gold $1,600 and Platinum $3,300 per team per year. Multi-team club packages are quoted. Some pages say pricing is per program — [Hudl club pricing](https://www.hudl.com/pricing/club/basketball); [Hudl high school](https://www.hudl.com/pricing/high-school)
- Dance Studio Syllabus (iOS teaching-video library) sells a "Studio System" at $99.99/month or $999.99/year alongside $39/$390 subscriptions — [App Store](https://apps.apple.com/us/app/id6758198806)
- Dance studio management tools are priced per studio: JackRabbit Dance $49/$89/$245 per month, and a branded student app needs an upgrade. Wellyx from $49, TeamUp from $23.99 (scaled by active customers), Mindbody from $99/month. These are aggregator figures and weren't verified on vendor pages — [Gymdesk dance software guide](https://gymdesk.com/blog/best-dance-software); [Fitgap](https://us.fitgap.com//search/dance-studio-software)
- QwikCut sells a dance-studio plan with 50 hours of private video storage that "only you and your dancers can access" and a highlights builder. Price not found — [QwikCut](https://www.qwikcut.com/?p=4122)
- Uscreen (white-label video and branded apps): Starter $49/month (100-subscriber cap), Growth $149/month plus $1.99 per subscriber, App Essentials (branded iOS and Android) $449/month plus $0.99 per subscriber. Partly from vendor and competitor blogs — [Vodlix comparison (competitor)](https://vodlix.com/uscreen-alternative.md); [Toolradar](https://toolradar.com/tools/uscreen/pricing)
- Tonara (music teacher and student practice app): pricing sources conflict ("completely free" vs from $9.99/month vs an older $39/month premium figure); unverified — [Subger](https://subger.com/nl/service/tonara); [9to5mac (dated)](https://9to5mac.com/?p=540454)

### Inferences
- A Spino school plan modelled on CoachNow and Onform could charge the instructor or school per studio. A plausible price would be £15–40/month per instructor, or £150–400/year per school (inference). That plan would unlock premium for all linked students while the class is active, plus instructor-branded roadmap templates and class recap distribution. Because Spino stores videos on the phone, "recap distribution" would need a share or link mechanism, which may add hosting cost.
- An alternative with less sales friction is per-student codes sold to schools in bulk (for example £1–2 per student per month, discounted). This uses Apple and Google offer codes or a school redeem link, so the RevenueCat entitlement model barely changes.
- Paying per seat for students is unusual in this niche. The comparators keep students free so instructors face no adoption friction.

### Gaps
- Pricing for TeamSnap, Mindbody's branded app, Practice Space and BJJ-gym technique apps was not retrieved.
- No dance-specific B2B2C app with student recap video and per-studio pricing was found. This may be a whitespace opportunity, but that is unconfirmed.

## 4. Content packs and marketplace (instructor curricula, revenue share)

### Takeaway
Revenue shares vary widely with who brings the audience. Platform-audience marketplaces pay creators about 15–50%. Instructor-referred sales pay 70–97%. BJJ Fanatics, the closest analogue to niche movement instructionals, is widely reported (not officially) at about 50/50.

### Cited Findings
- BJJ Fanatics reportedly splits about 50/50, with top names at 40–60%. This isn't published officially; the figures come from blogs citing interviews — [BJJMore](https://bjjmore.com/bjj-net-worth/); [MetamatWarriors](https://metamatwarriors.com/bjj-fanatics)
- Udemy: the subscription instructor pool reportedly fell from 25% (Jan 2024) to 15% (Jan 2026) of subscription revenue, split by minutes watched. Marketplace sales pay 37%, and instructor-promoted sales pay 97%. These are third-party reports; the official page is [Udemy support](https://support.udemy.com/hc/articles/229605008-Instructor-revenue-share) — [Ruzuku](https://ruzuku.com/learn/articles/is-udemy-any-good)
- Skillshare changed teacher earnings from 1 Jan 2026 and eligibility from 16 Jul 2026. Third-party estimates of the royalty pool share conflict (20% vs 30–50%) — [Skillshare help](https://help.skillshare.com/hc/en-us/articles/41694886825229-Skillshare-Teacher-Earnings-Update-Effective-January-1-2026); [Course Coach](https://course-coach.pages.dev/blog/udemy-vs-skillshare-which-pays-more/)
- General rule from one guide: when the platform supplies the audience, it keeps 60–70%; when the creator brings the audience, the creator gets 70–80%. Knowlify pays 95% on referral or coupon sales and 50% on organic sales — [LearnyBox](https://learnybox.com/en/blog/how-to-create-an-instructor-revenue-sharing-model/); [Knowlify agreement](https://courses.knowlify.com/legal/instructor-agreement)
- TrainHeroic, for comparison, separates a "Coach Plan" (coach pays for tools) from "Marketplace" (selling programmes to the public). The details weren't retrievable (403) — [TrainHeroic support](https://support.trainheroic.com/hc/en-us/articles/18156702444301)
- App store commission sits on top of any split: Apple's Small Business Program charges 15% (enrolment needed), and Google charges 15% on subscriptions. Google's fee structure for the UK, EEA and US changed on 30 Jun 2026, with a reported 10% service fee plus 5% if Play Billing is used. Sources differ on details — [RevenueCat on SBP](https://www.revenuecat.com/blog/engineering/small-business-program.md); [FoxData](https://foxdata.com/en/blogs/google-play-store-opens-external-billing-fees-drop-to-10-starting-june-30-2026/)

### Inferences
- For Spino, sold content packs (for example "Spino Method Bachata Level 1 roadmap plus reference clips" or guest-instructor packs) fit well. They can be non-consumable IAPs or premium-entitlement content. With third-party instructors, a 50/50 split after store fees (or 70–80% to the instructor on sales they refer through their own code) matches market norms.
- Content would have to be hosted, unlike user videos stored on the phone. That changes the cost profile, though it stays small at niche scale.
- In year 1 a marketplace probably adds complexity (payouts, VAT, contracts). First-party Spino Dance Method packs are simpler.

### Gaps
- No data on sales volumes for dance-specific instructional packs. STEEZY revenue estimates conflict ($70K/month per Adapty vs <$10K/month iOS per AppGoblin) — [Adapty](https://adapty.io/paywall-library/steezy/); [AppGoblin](https://appgoblin.info/apps/1296001664)

## 5. Partnerships: festivals and congresses, school-pass bundles, affiliates and ambassadors

### Takeaway
The Latin dance scene already runs on instructor discount codes, street teams and ambassadors (for example NYISC and the Hawaii Congress). Platform tooling now makes bundling app access with passes possible: offer codes work for every IAP type. There is no documented case of a dance app bundled with congress passes.

### Cited Findings
- New York International Salsa Congress runs a Street Team (ambassadors who drive ticket sales) and Community Partner discount codes — [NYISC Street](https://www.newyorksalsacongress.com/street); [NYISC Community Partner](https://www.newyorksalsacongress.com/communitypartner)
- Hawaii Salsa & Bachata Congress tells buyers to get discount codes from "your favorite instructors, performers, and DJs" — [Hawaii Congress](https://www.eventcreate.com/e/hawaiisalsabachatacongress)
- Salsa Vida sells festival media partnerships, including affiliate ticket links and promo codes — [Salsa Vida](https://www.salsavida.com/advertise/)
- Dance-adjacent apps exist for events (Dancetomic, FullPass) and courses (BeBachata Online, subscription) — [Dancetomic](https://mwm.ai/apps/salsa-app/6745124781); [FullPass](https://apps.apple.com/us/app/fullpass/id1632935220); [BeBachata](https://apps.apple.com/ng/app/bebachata-online/id6475026589)
- Apple offer codes now cover consumables, non-consumables, non-renewing and auto-renewable subscriptions (iOS 16.3+). A third-party source reports a shared quota of 1M per quarter, which wasn't verified — [Apple developer news](https://developer.apple.com/news/?id=gf6mgrs6); [Stora blog](https://stora.sh/blog/2026-03-31-apple-killed-promo-codes-offer-codes-are-better)
- Family Sharing covers auto-renewable subscriptions and non-consumables for up to 5 other family members (if the developer enables it). Consumables can't be shared — [Apple support](https://support.apple.com/kb/HT4009). A third-party source says the offer-code discount period applies only to the redeeming Apple ID — [Sonar](https://trysonar.app/blog/apple-subscription-offers-compared.md)

### Inferences
- Possible bundles: a "Congress pass + 3 months of Spino Premium" offer code given at registration, with Spino used to recap festival workshops; a "School term pass" where a term's fee includes Spino Premium via bulk offer codes; and instructor ambassador codes with a recurring commission (for example 20–30% of the first-year net). The commission percentage is an inference with no dance-specific benchmark.
- Festival workshop recap is a strong use case for the auto-cut 8-count feature, because attendees film many workshops in a weekend.

### Gaps
- No evidence of conversion rates from festival bundles or ambassador programmes in dance apps.
- No published ambassador commission rates from dance brands were found (one ambassador programme page exists: [SalsaNueva](https://shop.salsanueva.fr/en/pages/programme-ambassadeur), terms not read).

## 6. Owner-brand synergy: the app as a funnel vs a standalone product

### Takeaway
No directly sourced case study was found. Indirect evidence: the creator-referred revenue split premium (97% for Udemy instructor-promoted sales vs 37% marketplace) shows how valuable an owned audience is. CoachNow's and Onform's "coach pays, student free" model shows the instructor relationship driving adoption.

### Cited Findings
- Udemy pays 97% on instructor-promoted sales vs 37% on marketplace sales, which values an instructor's own audience as the main acquisition channel (third-party report) — [Ruzuku](https://ruzuku.com/learn/articles/is-udemy-any-good)
- When the creator brings the audience, splits usually move to 70–80% for the creator — [LearnyBox](https://learnybox.com/en/blog/how-to-create-an-instructor-revenue-sharing-model/)
- Branded-app platforms (Uscreen, Wellyx, JackRabbit) sell "your studio in an app" to studios, which shows studios will pay for brand presence with students — [Gymdesk](https://gymdesk.com/blog/best-dance-software); [Toolradar Uscreen](https://toolradar.com/tools/uscreen/pricing)

### Inferences
- Funnel model: Spino is free or cheap for Spino Dance Method students and acts as a retention and practice tool that sells classes, courses and congress trips. App revenue matters less than the extra class retention and course sales.
- Standalone model: other schools must be willing to adopt it. A heavily Spino-branded app may put off competing schools. A neutral app brand with a "Spino Method" content pack and a white-label or co-branded school tier reduces that conflict.
- A hybrid is likely best. Keep the consumer app neutral (organiser plus auto-cut), make Spino Method curricula a first-party content pack, and give partner schools their own branded roadmaps.

### Gaps
- No case studies were found of dance or martial-arts schools whose own app became a standalone product. A dedicated search on creator-owned apps (for example Gracie University or yoga-teacher apps) would help.

## 7. Pitfalls: price anchoring, hobby churn, seasonality

### Takeaway
Hobby and fitness-style apps see a January spike in installs and refunds, followed by February–March churn. Annual plans protect against this but often cancel in month 1. Monthly-only or annual-only setups both leave revenue on the table.

### Cited Findings
- January refund rates spike as resolution users quit within a week. Health & Fitness is hit hard by seasonal churn — [RevenueCat, New Year churn](https://www.revenuecat.com/blog/growth/how-to-tackle-new-year-subscription-churn.md)
- Health & Fitness (and Gaming) exceed their autumn baseline during New Year and January; other categories stay below it — [RevenueCat holiday offers](https://www.revenuecat.com/blog/growth/holiday-offers-subscription-apps.md)
- Estimated Health & Fitness monthly churn is 7–15%, driven by motivation decay. These are third-party estimates — [AppsOps](https://appsops.store/blog/ios-subscription-churn-benchmarks-by-category-2026)
- About 30% of annual subscriptions are cancelled in the first month (2025 report) — [RevenueCat SOSA 2025](https://www.revenuecat.com/state-of-subscription-apps-2025?lang=en-US)
- The market is concentrating: the top 25% of apps grew MRR 80%+ year on year, while the bottom 25% shrank more than 33% — [RevenueCat 2026 benchmarks](https://www.revenuecat.com/blog/growth/subscription-app-trends-benchmarks-2026.md)
- Price anchoring: lower lifetime multiples can erode revenue, and RevenueCat advises erring higher — [RevenueCat](https://www.revenuecat.com/blog/growth/lifetime-subscriptions.md)

### Inferences
- Dance seasonality probably follows the school term (September and January intakes) and the congress calendar, not just New Year. A school-term pass of 3–4 months could fit better than monthly billing. This is an inference; no dance-specific seasonality data was found.
- Launching at a very low price (for example £1.99) to "be cheap" makes later rises hard. It's better to start near the £4.99 ceiling and discount through codes, trials and bundles.
- The first-session experience decides trial outcomes (55% of 3-day trial cancels happen on Day 0). Onboarding should get users to their first roadmap or auto-cut quickly.

### Gaps
- No dance or hobby-learning-specific churn or seasonality data was found. The figures above are proxies from Health & Fitness.

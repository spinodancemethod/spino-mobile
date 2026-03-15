# Features

- Added the roadmap screen as a dedicated dashboard tab between On Deck and Library.
- Grouped the home subscription status text and workspace CTA into a single conditional subscription tile for clearer paid-state UX.
- Switched favourite action icons from heart/heart-outline to map/map-outline across shared UI components and dashboard tab config.
- Updated roadmap rendering to include only favourited videos, grouped by position, so users can build a custom roadmap from saved content.
- Added a roadmap toggle to show empty positions and display a "No favourites yet" marker so users can spot skill gaps.
- Reworked the roadmap layout into vertical position rows with each position's chosen videos displayed beside it for easier gap scanning.
- Set the roadmap to open slightly zoomed out from its top-left origin so the Positions header is immediately visible on entry.
- Stabilized roadmap canvas height across the empty-position toggle so the chart no longer jumps vertically when the filter changes.
- Nudged the roadmap's initial vertical viewport upward so the positions tile starts higher on screen without changing toggle/zoom behavior.
- Added a conditional Subscribe CTA on Home for non-subscribed users that routes to a dedicated subscription flow.
- Added a new private subscription purchase/cart page with plan selection and checkout placeholder UI.
- Connected subscription checkout to a Supabase Edge Function + Stripe session flow, including app-side mutation hook and hosted checkout URL launch.
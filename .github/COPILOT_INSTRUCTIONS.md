# GitHub Copilot / Automated Assistant Instructions for spino-mobile

Purpose
- Short guide for any automated assistant (Copilot-style) that will edit or review this repository.

Repository overview
- Tech: React Native (Expo), TypeScript.
- Where the app lives: `app/` (screens/components). Key files: `app/your-roadmap.tsx` (roadmap canvas), `lib/hooks/` (data hooks), `Components/` (UI primitives), `constants/` (theme + styles).

Goals for automated edits
- Make minimal, well-scoped edits. Prefer small patches that are easy to review.
- Preserve existing patterns: use `useTheme()` for colors, `ThemedText`/`ThemedView` for UI, and existing hooks (`usePositions`, `useVideos`) for data.
- Run a quick typecheck after edits: `npx -y tsc --noEmit`.
- If UI changes are made, prefer runtime-safe defaults and keep platform parity (iOS/Android).

Style and safety
- Do not add or leak secrets (API keys, tokens, or .env values). If credentials are required, request them explicitly from maintainers.
- Prefer existing project conventions over adding new libraries. If a dependency is necessary, add it only after confirming with a human and update `package.json`.
- Keep edits backward-compatible. Avoid large refactors without approval.

Testing & validation
- Typecheck: `npx -y tsc --noEmit`.
- Dev run: `npx expo start -c` (clear cache) and test on device/emulator.

Files & commits
- When creating files, place them in the appropriate folder. Config for Copilot helpers belongs under `.github/`.
- Keep commit messages short and descriptive: e.g., `your-roadmap: make node modal theme-aware`.

If you need additional context
- Read `AGENTS.md` and the `constants/` (ThemeProvider, useTheme) for theme behavior.
- Ask the repo owner before making large UI/UX changes or adding new dependencies.

---
Generated: minimal Copilot instructions for quick edit guidance.

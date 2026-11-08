# Decisions

- **HyperFormula, GPL-v3.** Fine for an open-source release. For a closed commercial site, buy a HyperFormula commercial licence and replace the key in `lib/grid/engine.ts`. Decide before launch.
- **Other libraries:** Next.js, React, Tailwind, Supabase JS, pdf-lib, lucide-react (MIT/Apache); Inter and IBM Plex Mono via Fontsource (SIL OFL).
- **Billing:** Razorpay REST without the SDK so there is nothing to keep in sync.
- **Free during beta:** `NEXT_PUBLIC_PAYWALL_ENABLED` defaults to false.
- **Name:** "Gridwise" is a placeholder; change it in `lib/config.ts`.

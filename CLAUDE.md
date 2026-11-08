# Gridwise

A browser site where people learn spreadsheet formulas by typing them into a practice sheet and getting checked. Full requirements: `docs/PRD.md` (the original PDF is the source).

## Commands
- `npm run dev`, `npm test`, `npm run typecheck`, `npm run build` (runs the lesson validator first), `npm run e2e`

## Rules
- Use only colours, spacing and radii from `docs/design-tokens.ts`. No hard-coded values.
- Answers are checked by value, not by exact text. The checker lives in `lib/checker`.
- Lesson content lives in `content/lessons/*.json`; run `npm run validate:lessons` after editing. Standard: under 3 minutes, at most 3 intro sentences, exactly 3 hints, at least 3 correct and 3 wrong test overlays.
- Job tests are scored on the server only. Expected answers must never reach the browser.
- Never put the service role key in client code. Only `lib/server/*` may use it.
- Do not use the word "Excel" in the product name or marketing headings. Keep the trademark disclaimer in the footer.
- Plain, short, active sentences in all UI text.

## Layout
`lib/grid` engine (HyperFormula + custom functions), `lib/checker`, `lib/progress`, `lib/server` (billing, tests, auth), `components/grid` sheet UI, `supabase/migrations` SQL.

# Setup guide

Everything in the code works without any account: lessons, checker, shortcut trainer, placement and tests run in guest mode with progress saved in the browser. The steps below switch on accounts, payments and certificates. Do them in this order.

## 1. Run it locally
```
npm install
npm run dev        # http://localhost:3000
npm test           # unit tests
npm run build      # also validates every lesson
```
Without Supabase keys, a dev user is used for the test and certificate routes. This fallback is disabled when `NODE_ENV=production`.

## 2. Supabase (accounts and saved progress)
1. Create a project at supabase.com. Pick the region closest to your learners.
2. Open **SQL Editor**, paste `supabase/migrations/001_init.sql`, run. Then run `002_classroom.sql`.
3. **Settings → API**: copy the Project URL, the anon key and the service_role key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. The service role key is secret: never prefix it with NEXT_PUBLIC and never commit it.
4. **Authentication → URL Configuration**: set Site URL to your live domain and add `http://localhost:3000/**` and `https://YOUR-DOMAIN/**` to Redirect URLs (password reset needs `/account/reset`).
5. Optional Google sign-in: **Authentication → Providers → Google**, create OAuth credentials in Google Cloud Console, add the callback URL Supabase shows.
6. Check: sign up in the app, complete a lesson, open Table Editor and see rows in `lesson_progress` and `xp_events`.

## 3. Razorpay (payments)
Leave `NEXT_PUBLIC_PAYWALL_ENABLED` unset (or `false`) until this works. While false, everything is free.
1. Create a Razorpay account and finish KYC. Start in **Test mode**.
2. **Settings → API Keys**: generate keys, set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET`.
3. **Subscriptions → Plans**: create a monthly plan (₹199) and a yearly plan (₹1499). Put the plan ids in `RAZORPAY_PLAN_MONTHLY_INR` and `RAZORPAY_PLAN_YEARLY_INR`. For USD, enable international payments on your account and set `RAZORPAY_PLAN_MONTHLY_USD`, `RAZORPAY_PLAN_YEARLY_USD` ($7 and $49). If you prefer Stripe for global customers, only `lib/server/billing.ts` and `app/api/webhooks` need replacing.
4. **Settings → Webhooks**: URL `https://YOUR-DOMAIN/api/webhooks/razorpay`, choose a secret, set it as `RAZORPAY_WEBHOOK_SECRET`. Enable all `subscription.*` events and `payment.failed`.
5. Test with Razorpay's test cards: subscribe, cancel, and confirm the `subscriptions` row changes. A cancelled plan stays active until the period ends; a failed payment gets a 7 day grace period.
6. Switch to Live keys, redo the plans and webhook in Live mode, then set `NEXT_PUBLIC_PAYWALL_ENABLED=true` and redeploy.

## 4. Hosting
Vercel works with no config: import the repo, add every variable from `.env.example`, set `NEXT_PUBLIC_SITE_URL` to the final domain (certificate links use it), deploy. Any Node 20 host works with `npm run build && npm start`.

## 5. Optional
- **Sentry**: set `NEXT_PUBLIC_SENTRY_DSN`. Errors post to Sentry without the SDK.
- **Analytics**: events are sent only after the visitor accepts the consent banner. They go to `/api/events`, which logs them on the server; connect it to your analytics tool there. `NEXT_PUBLIC_ANALYTICS_DEFAULT=on` skips the consent prompt (only if your lawyer agrees).
- **Contact email and site name**: `NEXT_PUBLIC_CONTACT_EMAIL`, and `PRODUCT` in `lib/config.ts` for the name.

## 6. Legal (needs a person, not code)
The privacy policy, terms and accessibility pages are drafts. Have a lawyer in your country review them, decide the refund rule and the minimum age (`PRODUCT.minimumAge`, placeholder 16), and confirm the product name does not use Microsoft's trademark.

## 7. Tests only you can do
- Ask 5 to 10 real learners to do the first three modules while you watch silently; note where they hesitate.
- Review all 30 lessons for correctness and tone (the PRD expects you to author Stage 3 content; these are drafts).
- On a real phone: type formulas, use the symbol row, finish a Pro test and download the certificate.
- Subscribe, cancel and fail a payment in Razorpay test mode.

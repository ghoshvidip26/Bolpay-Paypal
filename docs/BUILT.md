# What is built so far

Updated 2026-11-07. PRD section numbers refer to [PRD.md](./PRD.md). See [REMAINING.md](./REMAINING.md) for what is left.

## Verified against real services (sandbox)
- **PayPal Payouts:** a US business sandbox account sends payouts. The India business account is blocked by PayPal (`PAYOUT_NOT_AVAILABLE`), so the app uses US sandbox credentials.
- **Through the app:** submit period → approve → PayPal batch → sync → `completed`, and a worker with no PayPal email fails with a clear reason. Retry creates a new batch (attempt 2) and completed. Needs Review payouts are refused at approval.
- **Voice chain:** generated speech → `/api/voice-input` (ElevenLabs Scribe) → `/api/intent` (Groq) → plan → `/api/voice-output` (ElevenLabs TTS). Tested with an English prepare-incentives command, a payout-status question, "mark Ravi Kumar present" and a Hindi attendance command. All returned correct plans. Nothing is executed by `/api/intent`; it only returns a plan.
- **Not yet verified:** webhooks (need a public URL), live microphone capture in a browser, and clicking through every screen.

## Data and rules (PRD §5.2, §5.5)
- **Seed data:** 25 synthetic Bengaluru riders (`app/lib/merchant/mock-data.ts`) with sandbox PayPal emails `bolpay-worker-1…24@personal.example.com`. Rider 25 has no email (deliberate failure case), rider 24 is inactive. Deliberate data problems: riders 7 and 13 miss attendance records, rider 18 is marked absent with deliveries logged.
- **City** field on workers, with a city filter on the Workers screen.
- **Tiered delivery incentives:** on each worked day the highest tier reached is paid once (default 10 / 20 / 30 deliveries → ₹50 / ₹100 / ₹150), editable on the Incentives screen. Plus wage, overtime, per-unit incentive above a daily target, and an attendance bonus.
- **Rule versioning:** every rules change bumps a version. Each payout stores the version and a snapshot of the rules it used.
- **Needs Review:** missing attendance days or absent-with-deliveries records flag the payout `needs_review`. It can't be approved until the data is fixed and the period is submitted again. Enforced on the server, shown on the Payouts screen.
- **Prepare filters:** `POST /api/payouts/submit-period` accepts `{ city, minUnits, date }`. The voice command "…Bengaluru riders who completed at least 20 deliveries today" resolves to this filter. Workers who qualify get the full period amount from the rules engine (see Remaining for the simplification).
- **CSV import** on the Workers screen: workers (`name, role, city, phone, payoutEmail, dailyWage`) and deliveries (`worker, date, deliveries, status, overtime`), via `POST /api/import`. Row errors are reported; duplicates are skipped.
- **Audit log:** calculations, approvals, rule changes and imports are recorded in the database (`audit`). It is not shown in the UI yet.

## Currency
- Amounts are stored and displayed in **₹**. PayPal settles in USD: the conversion happens in one place (`submitToPayPal`) at `INR_PER_USD` (default 85). Each transaction stores the USD amount and the rate, and the Transactions screen shows both.
- Reason: PayPal blocked the India sender account, and sandbox payouts in INR to other countries are unverified.

## Backend (Next.js route handlers, no Express)
- Service layer with validation (`app/lib/server/service.ts`) and thin API routes under `app/api/**`.
- Persistence: file-backed JSON at `.data/db.json`. It carries a `schemaVersion`: an older file is discarded and reseeded automatically on the next request. Each database also has a random salt in its PayPal batch IDs, so a reseed never collides with earlier test batches.
- Duplicate prevention: deterministic `sender_batch_id` (payout ids + salt + attempt).
- Webhook endpoint with PayPal signature verification (`PAYMENT.PAYOUTS-ITEM.*`); sync action as fallback. Untested without a public URL.

## Frontend
- Merchant dashboard, workers, attendance, incentives, payouts, transactions; voice assistant with microphone capture and spoken replies; PayPal checkout page.

## Environment
- `.env.example` documents every variable, including `INR_PER_USD`.

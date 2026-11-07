# What is built so far

Updated 2026-11-07. PRD section numbers refer to [PRD.md](./PRD.md). See [REMAINING.md](./REMAINING.md) for what is left.

## Verified against real services (sandbox)
- **PayPal Payouts:** a US business sandbox account sends payouts. The India business account is blocked by PayPal (`PAYOUT_NOT_AVAILABLE`), so the app uses US sandbox credentials.
- **Through the app:** submit period → approve → PayPal batch → sync → `completed`, and a worker with no PayPal email fails with a clear reason. Retry creates a new batch (attempt 2) and completed. Needs Review payouts are refused at approval.
- **Voice chain (single commands):** generated speech → `/api/voice-input` (ElevenLabs Scribe) → `/api/intent` (Groq) → plan → `/api/voice-output` (ElevenLabs TTS). Tested with an English prepare-incentives command, a payout-status question, "mark Ravi Kumar present" and a Hindi attendance command. All returned correct plans. Nothing is executed by `/api/intent`; it only returns a plan.
- **Voice assistant eval:** `npm run test:voice` passes 40 of 40 dry-run conversation fixtures (multi-step flows, clarification then answer, unrelated command superseding a question, spoken confirm in English, Hindi and Hinglish, cancel, a confirm-looking command that must not confirm, plan edits, ambiguous and unknown names, out-of-period dates, rule edits, prompt-injection attempts). Metrics for that run: 0 errors, model latency p50 about 0.7 s and p95 about 10 s (that tail is rate-limit failover), clarification rate 13 percent. Roughly 40 percent of planning calls were served by the fallback `gpt-oss-20b` because of Groq's per-model token limit.
- **Voice, real run:** "Calculate incentives for Mohammed Ali, then approve Mohammed Ali's payout" ran prepare, paused with the exact figures (1 payment, ₹9,403.75, US$110.63), sent only after a second confirm, and a later spoken "refresh the payment status, then tell me how many payments completed" reported it completed.
- **Voice panel in a browser** (typed commands): a pending question survives closing the panel and a full page reload, the answer continues the same request, the plan card appears with Confirm and Cancel, and "yes please" confirms and runs.
- **Not yet verified:** webhooks (need a public URL), live microphone capture in a browser, and clicking through every screen.

## Voice control (rebuilt)
Full details in [VOICE.md](./VOICE.md).
- **Multi-step commands:** one sentence can chain actions ("mark Anita absent, then prepare payouts for Bengaluru riders with at least 20 deliveries, then approve Ravi"). Steps run top to bottom.
- **Whole workflow by voice:** attendance, overtime, deliveries, prepare payouts, approve, reject, retry failed payments, refresh statuses, add a worker, update a worker's wage, email, city, role, phone or status, change rules and delivery tiers, 13 kinds of read-only questions, and navigation.
- **Multiple targets:** several names, "everyone", "everyone except X", a city, "workers missing attendance", a minimum delivery count. The server resolves who is meant, never the model.
- **Follow-ups keep their context:** a clarifying question (unknown or ambiguous name, missing status, wage, hours) is answered in the same session. An unrelated reply sets the question aside and says so. A reply while a plan is waiting can add to or change it ("also mark Anita").
- **Spoken confirm:** "confirm", "yes please", "haan kar do", "हाँ" and cancel phrases work by voice. Only a whole-utterance phrase confirms, so "OK, mark Ravi absent" is a new command.
- **Money checkpoint:** approve and retry steps show the exact payment count, ₹ total and US$ total, and ask again when earlier steps in the flow change the numbers or the numbers change before execution.
- **Session survives:** closing the panel, tapping the mic again or reloading the page keeps the pending question or plan (server-side session, 15 minute idle timeout). **New conversation** resets it.
- **Catalog-driven:** `app/lib/voice/catalog.json` holds every action, slot, clarifying question, example, confirm phrase and prompt rule; the planner prompt and validation are generated from it.
- **Metrics and eval:** `GET /api/voice/metrics` (latency p50/p95, clarification, supersede and error rates, models used) and `npm run test:voice` (40 dry-run conversation fixtures).
- **Rate-limit aware:** compact planner prompt, JSON mode, automatic failover from `openai/gpt-oss-120b` to `openai/gpt-oss-20b` (each model has its own 8,000 tokens per minute on Groq's free tier).

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

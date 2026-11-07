# What is built so far

Updated 2026-11-07. PRD section numbers refer to [PRD.md](./PRD.md). What is left: [REMAINING.md](./REMAINING.md). Voice details: [VOICE.md](./VOICE.md). Manual test and demo script: [DEMO.md](./DEMO.md).

## 1. Summary

| Area | State |
|---|---|
| Merchant dashboard (workers, attendance, incentives, approvals, transactions) | Working |
| PayPal Payouts (create batch, sync, retry, idempotent ids) | Working, verified on the sandbox |
| PayPal webhooks with signature verification | Implemented, **not yet tested** (needs a public URL) |
| Rules engine (wage, overtime, per-unit, daily tiers, attendance bonus, versions) | Working |
| Needs Review (missing or conflicting records) | Working |
| Voice assistant (multi-step, follow-ups, spoken confirm, exact-amount checkpoint) | Working, 40 of 40 fixtures; browser microphone untested |
| ₹ display with USD settlement | Working |
| CSV import (workers, deliveries) | Working |
| Authentication and roles | **Not built** |
| Database | JSON file (not Postgres) |

## 2. Verified against real services (sandbox)
- **PayPal Payouts:** a US business sandbox account sends payouts. The India business account is blocked by PayPal (`PAYOUT_NOT_AVAILABLE`), so the app uses US sandbox credentials.
- **Through the app:** submit period → approve → PayPal batch → sync → `completed`; a worker with no PayPal email fails with a clear reason; retry creates a new batch (attempt 2) and completes; Needs Review payouts are refused at approval; a rejected payout can be submitted again.
- **Voice assistant eval:** `npm run test:voice` passes **40 of 40** dry-run conversation fixtures: multi-step flows, clarification then answer, an unrelated command superseding a question, spoken confirm in English, Hindi and Hinglish, cancel, a confirm-looking command that must not confirm, plan edits, ambiguous and unknown names, out-of-period dates, rule edits, prompt-injection attempts. Metrics for that run: 0 errors, model latency p50 about 0.7 s and p95 about 10 s (that tail is rate-limit failover), clarification rate 13 percent. About 40 percent of planning calls were served by the fallback `gpt-oss-20b` because of Groq's per-model token limit.
- **Voice, real run:** "Calculate incentives for Mohammed Ali, then approve Mohammed Ali's payout" prepared the payout, paused with the exact figures (1 payment, ₹9,403.75, US$110.63), sent only after a second confirm, and "refresh the payment status, then tell me how many payments completed" reported it completed.
- **Voice panel in a browser** (typed commands, Playwright): a pending question survives closing the panel and a full page reload, the answer continues the same request, the plan card shows Confirm and Cancel, and "yes please" confirms and runs.
- **Not verified:** webhooks, real microphone recording, Kannada, Tamil and Bengali speech, `next build` (production), and a clean-clone run on another machine.

## 3. Screens
| Screen | What it does |
|---|---|
| `/dashboard` | Period summary, stat cards, recent transactions |
| `/workers` | List, search, city filter, add worker, inline wage edit, activate or deactivate, **import workers CSV**, **import deliveries CSV** |
| `/attendance` | Per-day status buttons, overtime hours, units; "mark remaining present" |
| `/incentives` | Live payout summary per worker (base, overtime, performance, delivery tiers, attendance bonus), rules editor with delivery tiers and rules version, submit for approval (shows how many are Needs Review) |
| `/payouts` | **Needs review** card with reasons, awaiting approval with per-worker breakdown and rule version, bulk approve and reject with a confirmation, decision history |
| `/transactions` | Status tabs, ₹ amount with the USD amount sent to PayPal, failure reasons, Retry, automatic status refresh every 4 s while anything is processing |
| Voice panel (every screen) | Conversation, plan card with step status, Confirm and Cancel, mic, typed input, New conversation, voice-reply toggle |
| `/checkout` | PayPal Orders checkout demo page (placeholder user, not part of the main flow) |

## 4. API inventory
| Route | Purpose |
|---|---|
| `GET /api/state` | Full snapshot for the UI |
| `POST/PATCH /api/workers`, `/api/workers/[id]` | Add and update workers |
| `PUT /api/attendance`, `PUT /api/rules` | Attendance edits, rule changes (bumps the version) |
| `POST /api/import` | CSV import of workers or deliveries |
| `POST /api/payouts/submit-period` | Calculate and queue payouts; optional `{city, minUnits, date}` |
| `POST /api/payouts/decide` | Approve or reject (approve sends to PayPal) |
| `POST /api/payouts/sync` | Pull statuses from PayPal |
| `POST /api/transactions/[id]/retry` | Retry a failed payment |
| `POST /api/webhooks/paypal` | Signature-verified payout item events |
| `POST /api/paypal` | Orders create and capture (checkout demo) |
| `POST /api/voice-input`, `/api/voice-output` | ElevenLabs speech-to-text and text-to-speech |
| `POST/GET /api/voice/turn` | One conversational turn; restore a session |
| `GET/DELETE /api/voice/metrics` | Voice quality metrics |
| `POST /api/intent` | **Legacy** single-intent route, unused by the UI (to be removed) |

## 5. Voice control
Full details in [VOICE.md](./VOICE.md).
- **Multi-step commands:** one sentence can chain actions ("mark Anita absent, then prepare payouts for Bengaluru riders with at least 20 deliveries, then approve Ravi"). Steps run top to bottom and stop at the first failure.
- **Whole workflow by voice:** attendance, overtime, deliveries, prepare payouts, approve, reject, retry failed payments, refresh statuses, add a worker, update a worker's wage, email, city, role, phone or status, change rules and delivery tiers, 13 kinds of read-only questions, and navigation.
- **Multiple targets:** several names, "everyone", "everyone except X", a city, "workers missing attendance", a minimum delivery count. The server resolves who is meant, never the model.
- **Follow-ups keep their context:** a clarifying question (unknown or ambiguous name, missing status, wage, hours) is answered in the same session. An unrelated reply sets the question aside and says so. A reply while a plan is waiting can add to or change it ("also mark Anita").
- **Spoken confirm:** "confirm", "yes please", "haan kar do", "हाँ" and cancel phrases work by voice. Only a whole-utterance phrase confirms, so "OK, mark Ravi absent" is a new command.
- **Money checkpoint:** approve and retry steps show the exact payment count, ₹ total and US$ total, and ask again when earlier steps in the flow change the numbers or the numbers change before execution.
- **Session survives:** closing the panel, tapping the mic again or reloading the page keeps the pending question or plan (server-side session, 15 minute idle timeout). **New conversation** resets it.
- **Catalog-driven:** `app/lib/voice/catalog.json` holds every action, slot, clarifying question, example, confirm phrase and prompt rule; the planner prompt and validation are generated from it.
- **Metrics and eval:** `GET /api/voice/metrics` and `npm run test:voice`.
- **Rate-limit aware:** compact planner prompt, JSON mode, automatic failover from `openai/gpt-oss-120b` to `openai/gpt-oss-20b` (each model has its own 8,000 tokens per minute on Groq's free tier).

## 6. Data and rules (PRD §5.2, §5.5)
- **Seed data:** 25 synthetic Bengaluru riders (`app/lib/merchant/mock-data.ts`) with sandbox PayPal emails `bolpay-worker-1…24@personal.example.com`. Rider 25 has no email (deliberate failure case), rider 24 is inactive. Deliberate data problems: riders 7 and 13 miss attendance records, rider 18 is marked absent with deliveries logged.
- **City** on workers, with a city filter.
- **Tiered delivery incentives:** on each worked day the highest tier reached is paid once (default 10 / 20 / 30 deliveries → ₹50 / ₹100 / ₹150), editable on the Incentives screen. Plus wage, overtime, per-unit incentive above a daily target, and an attendance bonus.
- **Rule versioning:** every rules change bumps a version. Each payout stores the version and a snapshot of the rules it used.
- **Needs Review:** missing attendance days or absent-with-deliveries records flag the payout `needs_review`. It can't be approved until the data is fixed and the period is submitted again. Enforced on the server.
- **Prepare filters:** city, minimum deliveries on a date, specific workers. Qualifying workers receive the full period amount from the rules engine.
- **Resubmit:** rejected payouts don't block a new submission (new ids `…-r2`); the old ones stay in the history.
- **CSV import:** workers (`name, role, city, phone, payoutEmail, dailyWage`) and deliveries (`worker, date, deliveries, status, overtime`), with row-level errors; duplicates are skipped.
- **Audit log:** calculations, approvals, rule changes, imports and voice flows are recorded in the database (`audit`); not shown in the UI yet.

## 7. Payments and currency
- Amounts are stored and displayed in **₹**. PayPal settles in USD: the conversion happens in one place (`submitToPayPal`) at `INR_PER_USD` (default 85). Each transaction stores the USD amount and the rate, and the Transactions screen shows both.
- Reason: PayPal blocked the India sender account, and INR payouts to other countries are unverified.
- Duplicate prevention: deterministic `sender_batch_id` (payout ids + per-database salt + attempt). A per-database salt means a reseed never collides with earlier test batches.
- Live-mode guard: payouts are refused when `NEXT_PUBLIC_PAYPAL_ENVIRONMENT=production` unless `ALLOW_LIVE_PAYOUTS=true`.

## 8. Backend and persistence
- Next.js route handlers with a service layer (`app/lib/server/service.ts`) and thin API routes; no Express server.
- Persistence: file-backed JSON at `.data/db.json`, atomic writes, `schemaVersion` (an older file is reseeded automatically), single process, not serverless-safe.
- Voice sessions and metrics are in memory (lost on restart).

## 9. Known limitations
- No authentication or roles; anyone who can reach the app can approve payouts.
- JSON file database; one process only.
- The voice assistant needs the Groq model; Groq's free tier allows 8,000 tokens per minute per model, so a burst of turns can wait or fall back to the smaller model.
- A flow cannot name a worker that an earlier step in the same sentence creates.
- "Today" and the pay period are fixed constants (3 Nov 2026, 21 Oct to 3 Nov).
- The UI and PayPal email still say "PayCrew".
- Legacy single-intent code (`/api/intent`, `voice-commands.ts`) is still in the repo.

## 10. Environment
`.env.example` documents every variable, including `INR_PER_USD` and `VOICE_PLANNER_MODELS`.

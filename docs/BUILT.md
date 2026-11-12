# What is built so far

Updated 2026-11-12. PRD section numbers refer to [PRD.md](./PRD.md). What is left: [REMAINING.md](./REMAINING.md). Voice details: [VOICE.md](./VOICE.md). Manual test and demo script: [DEMO.md](./DEMO.md).

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
| Authentication and roles (Supabase Auth: owner, supervisor, worker) | Working |
| Zoho HRMS import (OAuth connect, employees, attendance, repeatable sync) | Built; verified against a stand-in serving your real exports; **not yet run against your live Zoho portal** |
| Two separate datasets (Demo and Zoho HRMS) with a switch | Working |
| UI kit, toasts, sounds, settings, login and legal pages | Working |
| Attendance history in an AG Grid data grid (sort, filter, page, CSV export) | Working |
| Demo video production kit (script, timed shot list, narration generator) | Ready: [DEMO_VIDEO.md](./DEMO_VIDEO.md) |
| Hosted demo on Vercel | **Not deployed** (needs your Vercel login); steps and limits in [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) |
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
| `/attendance` | Per-day status buttons, overtime hours, units; "mark remaining present"; **attendance history** in an AG Grid grid below (click a date to open that day) |
| `/incentives` | Live payout summary per worker (base, overtime, performance, delivery tiers, attendance bonus), rules editor with delivery tiers and rules version, submit for approval (shows how many are Needs Review) |
| `/payouts` | **Needs review** card with reasons, awaiting approval with per-worker breakdown and rule version, bulk approve and reject with a confirmation, decision history |
| `/transactions` | Status tabs (All, Processing, **Awaiting sign-up**, Completed, Failed), ₹ amount with the USD amount sent to PayPal, failure reasons, Retry, **Cancel and refund** for unclaimed payments, automatic status refresh every 4 s while anything is processing (every 60 s while payments only wait for a sign-up) |
| Voice panel (every screen) | Conversation, plan card with step status, Confirm and Cancel, mic, typed input, New conversation, voice-reply toggle |
| `/integrations` | **Zoho HRMS**: status, Connect Zoho, Sync now, disconnect, last sync result, setup steps (owner only) |
| `/settings` | Per-device preferences: sounds, click sounds, volume, payment alerts |
| `/me` | Worker self-service: own attendance, earnings, payment history |
| `/login`, `/terms`, `/privacy` | Sign in (Supabase Auth) and the public legal pages |
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
| `GET/POST /api/workspace` | Which dataset is active; owners switch between `demo` and `zoho` |
| `GET /api/zoho/status` | Zoho configuration, connection, last sync, dataset size (owner) |
| `GET /api/zoho/connect`, `/api/zoho/callback` | Start and finish the Zoho sign-in (owner; one-time `state` cookie) |
| `POST /api/transactions/[id]/cancel` | Cancel an unclaimed payment and refund it (owner) |
| `POST /api/workers/sandbox-emails` | Give employees with no PayPal email a sandbox test address; never overwrites (owner) |
| `GET /api/export/sandbox-accounts` | CSV in PayPal's bulk sandbox-account template, 40 per file via `?part=` (owner) |
| `POST /api/zoho/sync`, `DELETE /api/zoho/sync` | Import from Zoho; forget the stored tokens (owner) |
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
- JSON file database; one process only.
- The voice assistant needs the Groq model; Groq's free tier allows 8,000 tokens per minute per model, so a burst of turns can wait or fall back to the smaller model.
- A flow cannot name a worker that an earlier step in the same sentence creates.
- The Demo dataset is pinned to fixed dates (3 Nov 2026, period 21 Oct to 3 Nov) so the trained demo always looks the same. The Zoho dataset uses the real date (India time) and the calendar month.
- The Zoho connection (tokens) is one record for the whole server, not per business.
- On a host with a read-only project folder the JSON files must live in a writable folder (`DATA_DIR`, for example `/tmp`), which is wiped on cold starts; see [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md).
- Legacy single-intent code (`/api/intent`, `voice-commands.ts`) is still in the repo.

## 10. Environment
`.env.example` documents every variable, including `INR_PER_USD` and `VOICE_PLANNER_MODELS`.

## 11. Authentication and roles (added by the team, 2026-11-11)
- **Login:** Supabase Auth (email and password). `proxy.ts` refreshes the session and sends signed-out visitors to `/login`; pages and route handlers verify the session and role again (`app/lib/auth/dal.ts`, `app/lib/server/http.ts`).
- **Roles:** owner (everything, including approving and moving money), supervisor (attendance, prepare payouts by voice; no money), worker (only `/me`). Owner-only API routes return 403 to other roles, and the voice assistant refuses owner-only steps for supervisors.
- **Schema:** relational schema with row-level security in `supabase/migrations/`, demo logins in `supabase/seed.sql`. Business data itself still lives in the JSON files; Supabase holds logins and roles.
- **UI:** shared component kit, toasts, quiet interaction sounds and payment alerts, settings page, skeleton loading states, MIT license.

## 12. Zoho HRMS integration (added 2026-11-12)
Lets a business that runs HR on Zoho People start paying through BolPay without re-keying people.

**Two datasets.** The app now has two fully separate workspaces behind one switch in the sidebar (each person's own choice, kept in their own cookie, so switching never changes what anyone else sees): **Demo** (the trained 25-rider Bengaluru dataset, unchanged) and **Zoho HRMS** (starts empty, filled by a sync). Each has its own workers, attendance, payouts, transactions, rules and PayPal batch ids (`.data/db.json` and `.data/zoho.json`). Every screen, payout flow and the voice assistant work on whichever dataset is active, because everything reads through `getDb()`; "today" and the pay period come from `getToday()` and `getPeriod()` (`app/lib/server/context.ts`).

**Connect.** The owner presses Connect Zoho on `/integrations`: OAuth 2.0 authorization-code flow against `accounts.zoho.in` with a one-time `state` cookie. Tokens are stored server-side in `.data/integrations.json` (never sent to the browser). A `ZOHO_REFRESH_TOKEN` in `.env` (Zoho "Self Client") works instead of the redirect flow.

**Sync now** (`POST /api/zoho/sync`, `app/lib/zoho/`):
- Employees: `GET people.zoho.in/people/api/forms/employee/getRecords`, 200 per call, paged. Mapped by `mapper.ts` (accepts both the API field names and the Zoho UI export column labels).
- Attendance: `GET .../attendance/getUserReport` for the current month, 100 employees per call. Present, half day (under 4 hours), absent, leave types and overtime are mapped; weekends, holidays and unmarked days are skipped.
- **Ownership rules:** Zoho owns identity (name, role, department, city, phone, joining date, active status) and the attendance of days it reports; a re-sync updates them. BolPay owns pay: the daily wage and PayPal email are set once when an employee is first imported and a sync never overwrites them.
- **Salary:** Zoho People has no salary API (payroll is the separate Zoho Payroll product). New employees get `ZOHO_DEFAULT_DAILY_WAGE`, or a value read from a custom field named in `ZOHO_WAGE_FIELD`. HR edits wages on the Workers screen or by voice.
- **PayPal email:** the Zoho work email by default (or `ZOHO_PAYOUT_EMAIL_FIELD`). Zoho test employees have fake `zylker.com` addresses, so sandbox payouts to them stay unclaimed until real sandbox emails are set (voice: "set Michael Johnson's PayPal email to ...").
- **Needs Review** applies to the synced data; for Zoho employees weekends are not counted as missing, so HR is asked to mark the unmarked weekdays before payouts can be approved.

**Verified:**
- The mapper with `node scripts/zoho-mapper-check.mjs`: 6 offline checks, plus all 18 rows of the real `Employee View.xlsx` export.
- The full sync (token refresh, paging, mapping, database writes) against a throwaway local stand-in serving the real exports (18 employees and the real attendance row of one employee). Results: 18 created; a second sync 0 created and 18 updated; an edited wage and PayPal email survived the re-sync; attendance landed on the right employee; Needs Review flagged the unmarked weekdays and not the weekends; the voice assistant planned and answered correctly on the Zoho dataset ("today" = the real date); the Demo dataset was unchanged (25 workers, 24 payouts).
- **Not verified:** a run against the live Zoho portal (needs the owner's Client ID and Secret), and the exact OAuth scope name for attendance (`ZOHOPEOPLE.attendance.READ` is the default; if Zoho rejects it, use `ZOHOPEOPLE.attendance.ALL`).

## 13. Unclaimed payments, sandbox accounts and sync fixes (2026-11-12)
- **Awaiting PayPal sign-up.** When an employee's email has no PayPal account, PayPal accepts the payout, emails them a sign-up link and reports `UNCLAIMED` (error `RECEIVER_UNREGISTERED`); the money is held for 30 days and then returns to you. Before, the app showed this as "processing" forever and its 4-second polling never stopped. It is now a separate `unclaimed` transaction status with a plain explanation, shown in amber, counted separately, and checked only once a minute. It becomes `completed` on its own when the recipient claims it. Verified on the real payment to `ankrutisharma@gmail.com`.
- **Cancel and refund** (owners): calls PayPal's cancel-unclaimed-item API. **Not verified:** the PayPal sandbox answered this call with `INTERNAL_SERVICE_ERROR` on repeated tries for valid unclaimed items (it also requires the whole batch to be in `SUCCESS` status first), so the app shows PayPal's reference and says unclaimed money returns automatically after 30 days. The Retry button then re-sends after the PayPal email is fixed.
- **PayPal accounts card on Integrations.** Shows how many active employees have a PayPal email and offers two sandbox testing tools: give employees with no email a sandbox address (`bolpay-<employee id>@personal.example.com`, only fills empty ones), and download a CSV in PayPal's bulk template (up to 40 per file) to upload at developer.paypal.com → Testing tools → Sandbox accounts → Create bulk accounts. Verified on the Zoho dataset (18 addresses assigned, CSV columns match the template, data restored afterwards).
- **No API for creating or deleting PayPal accounts.** PayPal exposes none for sandbox (dashboard and bulk CSV only), and a live account can never be created for someone else. In production the sign-up link PayPal emails is the supported route.
- **Zoho emails.** Zoho returns an empty `EmailID` for the sample employees (the export's "Email address" is not on the employee form), so only employees whose profile has an email get one. A later sync now fills an *empty* PayPal email when Zoho gains one; an email you set is never overwritten.
- **Screen stayed empty after Sync now.** The screens keep their data in memory and only loaded it once, so after a sync the Workers page still showed the old list until the page was reloaded. Sync now (and the sandbox-email button) now hands the fresh server data to the screens. Verified with a live sync from the screen: 20 employees updated, 0 duplicated, 150 attendance records.

## 14. Final additions before submission (2026-11-12)
- **Per-person dataset.** The Demo / Zoho HRMS choice is stored in each person's own cookie (`bolpay_dataset`) and applied to every request through `AsyncLocalStorage` (`runInWorkspace`, `withRequestWorkspace`). Outside a signed-in request (the worker page, the PayPal webhook) the demo data is used; the webhook searches every dataset. Owners and supervisors can switch; roles still decide what they may do.
- **AG Grid attendance history.** AG Grid Community (MIT) data grid, themed to the app, paginated, sortable, filterable and exportable, loaded on demand (`next/dynamic`) because it is large. Enterprise features (Excel export, grouping, set filter) are deliberately not used.
- **Clearer feedback.** Toasts for Zoho sync, disconnect, test emails, awaiting-sign-up payments and completed or failed payments. Cancelling an unclaimed payment now uses an inline two-step confirmation (with a warning sound) instead of a browser dialog.
- **Hosting.** `DATA_DIR` moves the JSON files (and the Zoho token store) to a writable folder for hosts such as Vercel. A hosted deployment was **not** performed here; see [DEPLOY_VERCEL.md](./DEPLOY_VERCEL.md) for the steps and the limits of `/tmp` storage.
- **Demo video kit.** [DEMO_VIDEO.md](./DEMO_VIDEO.md) has the narration script, a timed shot list built from measured clip lengths, recording, ElevenLabs and editing steps, and ready-to-paste YouTube and Devpost text. `docs/demo-video/narration.json` holds the clips as data and `scripts/demo-narration.mjs` renders them. The narrator voice `sXcl1NoQHcU7NRh6Na5D` is an ElevenLabs library voice, which the API refuses on a free plan, so the final narration must be generated on the website (or after upgrading); the manager's voice-command clips were rendered with a premade voice.
- **Checked for the video:** the three demo voice commands plan correctly against the real planner (dry run), the approve step pauses at the exact-amount checkpoint, and "Yes, go ahead" confirms by voice.

## 15. State at submission
**Working and verified:** voice-driven multi-step flows with exact-amount checkpoints (40 of 40 eval fixtures, plus real runs), PayPal sandbox payouts through to completed, unclaimed-payment handling, Needs Review safeguards, roles and sign-in, Zoho People import against a live portal (20 employees, 150 attendance records), two datasets with per-person switching.
**Not verified or not done:** webhooks (need a public URL), cancel-and-refund on PayPal's sandbox (it returns an internal error), a real-microphone take (record it as part of the video), Kannada, Tamil and Bengali speech, a hosted deployment, and a production build run in this session (the team reported it passing). Open work is in [REMAINING.md](./REMAINING.md).

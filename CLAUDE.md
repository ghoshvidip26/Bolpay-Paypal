# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — dev server (http://localhost:3000)
- `npm run build` / `npm run start` — production build / serve
- `npm run lint` — ESLint (flat config, `eslint.config.mjs`)

There is no test suite configured.

AGENTS.md warns that this Next.js version (16.x, React 19) has breaking changes: read the relevant guide in `node_modules/next/dist/docs/` before writing Next-specific code.

## What this is

BolPay — a hackathon app for merchants to manage hourly/daily workers: attendance, incentive rules, payroll approval, and PayPal payouts, with a voice assistant (speak a command, get a spoken reply). Single Next.js App Router app; imports use the `@/app/...` alias.

## Architecture

**Server owns data and money logic; client mirrors it.**
- `app/lib/server/db.ts` — file-backed JSON DB at `.data/db.json`, seeded from `app/lib/merchant/mock-data.ts` on first use. Stands in for Postgres; single-process, needs a writable disk (not serverless-safe). Cached on `globalThis`.
- `app/lib/server/service.ts` — all business logic (workers, attendance, rules, payout approval, PayPal submission/retry/sync). Throws `ServiceError` (carries HTTP status). API routes under `app/api/**` are thin wrappers (helpers in `app/lib/server/http.ts`) around it. Payout amounts and emails are always read from server state, never from the client.
- `app/lib/merchant/store.tsx` — client context store holding the latest server `Snapshot` (`/api/state`). Attendance/rules/worker edits are applied optimistically and sent in order; anything that creates or moves money waits for the server snapshot.
- Pages in `app/(merchant)/*/page.tsx` are thin; the UI lives in `app/components/merchant/views/*View.tsx` inside `Shell`/`Sidebar`.
- Pay calculation is in `app/lib/merchant/incentives.ts` (shared client/server).

**UI kit and feedback.** Shared pieces are in `app/components/merchant/ui.tsx` (Card, Stats/Stat, Badge, Button/buttonClass, Segmented, Switch, Notice), `app/components/icons.tsx` (hand-drawn icons, brand mark) and `app/components/Skeleton.tsx` (loading states). The type scale is shrunk in `globals.css` (`text-sm` is 13px); font is IBM Plex. Toasts: `useToast()` from `app/components/feedback/Toaster.tsx` (provider is in `Shell`; store errors and PayPal completions/failures toast automatically). Sounds: `playSound()` in `app/lib/client/sounds.ts` (Web Audio, no files); every click/switch gets a quiet sound from `InteractionSounds` (root layout), and an element that plays its own sound needs `data-sound="off"`. Per-device settings (sounds, click sounds, volume, payment alerts) are in `app/lib/client/preferences.ts`, edited on `/settings` (sections via URL hash, e.g. `/settings#notifications`).
- Never override a utility the base already sets (e.g. `${inputClass} w-auto`): Tailwind doesn't let the later class win. Use `fieldClass("h-7 w-20 px-2 text-sm")`, `buttonClass(variant, size)`, `th`/`thRight`.
- The workspace grid column is `minmax(0,1fr)` and `Card` is `relative overflow-hidden`; both keep wide tables scrolling inside their card instead of widening the page. Public pages: `/login`, `/terms`, `/privacy` (listed in `PUBLIC_PATHS`, `app/lib/supabase/proxy.ts`).
- **Data grids (AG Grid Community, MIT).** Use `DataGrid` from `app/components/merchant/DataGrid.tsx` (themed to the app tokens, paginated, auto-height) for sortable/filterable/exportable tables; keep simple static tables on `th`/`td`. Only Community modules are registered; Excel export, row grouping, set filter, master/detail and the server-side row model are Enterprise (paid), so don't use them without a licence. `ag-grid-react` and `ag-grid-community` must stay on the same exact version. Load grids with `next/dynamic` (`ssr: false`): the grid is about 335 kB gzipped. Always pass `getRowId`. A pinned column with multi-row selection needs `selectionColumnDef: { pinned: "left" }`. `AttendanceHistory.tsx` is the reference use. In e2e tests, AG Grid recycles DOM rows: read order from the `row-index` attribute (absolute across pages, not per page), find rows by `row-id`, and wait out the row animation.

**PayPal** (`app/lib/paypal/`): `client.ts` uses `@paypal/paypal-server-sdk` (orders/checkout at `/checkout`, `/api/paypal`); `rest.ts` is a minimal raw REST client (OAuth token cache) for Payouts and webhook verification, which the SDK doesn't cover; `payouts.ts` builds batches and maps statuses. Payout batches use a deterministic `sender_batch_id` (hash of payout ids + attempt) so PayPal dedupes repeats. Status updates arrive via `/api/webhooks/paypal` and `/api/payouts/sync`.
- Sandbox by default; `NEXT_PUBLIC_PAYPAL_ENVIRONMENT=production` is "live" and payouts are refused unless `ALLOW_LIVE_PAYOUTS=true`.

**Voice/AI pipeline**: `/api/voice-input` (ElevenLabs speech-to-text) → `/api/intent` → `app/lib/server/intent-service.ts`, where an LLM (`app/lib/ai/intent.ts`, Groq) only *extracts* a structured intent and the server deterministically resolves workers/dates and builds an `IntentPlan` (types in `app/lib/merchant/intent-types.ts`). `translate.ts` localizes replies; `/api/voice-output` (ElevenLabs TTS, client in `app/lib/elevanlabs/` — note the spelling) speaks them. Client side: `VoiceAssistant.tsx`, `useSpeaker.ts`, `voice-commands.ts`.

## Environment variables

`NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_ENVIRONMENT`, `PAYPAL_WEBHOOK_ID`, `PAYOUT_CURRENCY` (default USD), `ALLOW_LIVE_PAYOUTS`, `ELEVEN_LABS_API_KEY`, `ELEVEN_LABS_VOICE_ID`, `ELEVEN_LABS_TTS_MODEL`, `GROQ_API_KEY`, `GROQ_MODEL`.

## Things that are easy to get wrong
- Amounts are stored and shown in **INR**; conversion to USD happens only in `submitToPayPal` (`INR_PER_USD`, default 85). Each transaction keeps `usdAmount` and `fxRate`.
- `.data/db.json` has a `schemaVersion` (`app/lib/server/db.ts`). Bump `SCHEMA_VERSION` when the data shape changes; older files are reseeded automatically. Seed data is in `app/lib/merchant/mock-data.ts` (25 Bengaluru riders with sandbox PayPal emails).
- PayPal's India business sandbox accounts can't send payouts; use a US business sandbox app.
- `submitPeriod` marks workers with missing or conflicting records `needs_review`; `decidePayouts` only acts on `pending`, so those can't be approved.
- Status docs: `docs/PRD.md`, `docs/BUILT.md`, `docs/REMAINING.md`.

## Voice assistant
- `app/lib/voice/` is the whole voice stack: `catalog.json` (every action, slot, phrase and prompt rule), `planner.ts` (LLM to ordered steps), `resolver.ts` and `selectors.ts` (validate against real records), `executor.ts` (runs steps, money checkpoint), `session.ts` (server-side conversation state), `queries.ts` (read-only answers), `metrics.ts`. Entry point: `POST /api/voice/turn`. The older `/api/intent` route and `voice-commands.ts` are no longer used by the UI.
- Add an action: catalog entry plus a `case` in `runStep` (executor.ts) plus eval fixtures. Test with `npm run test:voice` (needs the dev server and a Groq key). Details: `docs/VOICE.md`.
- Groq's free tier is 8,000 tokens per minute per model, so keep the planner prompt small.
- Turbopack sometimes serves a stale copy of an edited server module; if a function "is not a function" right after an edit, change the file's content and retry.

## Zoho People import and datasets
- Two workspaces, `demo` and `zoho`, each its own JSON file (`.data/db.json`, `.data/zoho.json`). Always go through `getDb()` (it returns the caller's workspace); `getDb("zoho")` reaches the other one explicitly. Each person picks their own dataset (cookie `bolpay_dataset`, set by `POST /api/workspace`); `respond()` / `withRequestWorkspace()` in `http.ts` run each request against it. Outside a signed-in request (worker page, PayPal webhook) it is `demo`; the webhook searches every dataset.
- Use `getToday()` and `getPeriod()` from `app/lib/server/context.ts`, never constants: the demo dataset is pinned to fixed dates, the Zoho dataset uses the real date and month.
- `app/lib/zoho/`: `mapper.ts` (pure, dependency-free, checked by `node scripts/zoho-mapper-check.mjs`), `client.ts` (OAuth, token store `.data/integrations.json`, API calls), `sync.ts` (writes the Zoho workspace). Routes: `/api/zoho/{status,connect,callback,sync}` and `/api/workspace`, all owner-only. UI: `/integrations` and the sidebar `WorkspaceSwitch`.
- A sync updates Zoho-owned fields (identity, attendance) and never overwrites `dailyWage` or `payoutEmail`.

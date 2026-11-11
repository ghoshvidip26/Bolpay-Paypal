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

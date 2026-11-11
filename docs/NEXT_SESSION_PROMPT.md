# BolPay: handoff prompt for the next Claude Code session

> Read this whole file before doing anything. It replaces the previous session's context.

## 0. Progress log (read first)

**2026-11-11, session 2 (pushed to main):** pulled the teammate's 15 commits (voice planner, real PayPal Payouts, JSON data store, docs in `docs/REMAINING.md`) and merged auth on top.
- **Data** stays in the teammate's JSON store (`app/lib/server/db.ts`, `.data/db.json`). **Supabase** holds logins and roles only (`members` table, `worker_ref` links a worker login to a worker id such as `w1`). The relational schema in `supabase/migrations/` (workers, attendance, payouts... with RLS) is live but unused by the app for now.
- **Auth:** `proxy.ts` (session refresh, redirect to /login), `app/lib/auth/dal.ts` (`getSession`, `requireRole`), `/login`, worker page `/me`. API: `respond(fn, roles)` in `app/lib/server/http.ts` requires staff by default; money/admin routes pass `OWNER`. Voice: `runPlan(..., role)` refuses owner-only steps for supervisors.
- **Demo logins** (password `BolPayDemo#2026`): owner@ / supervisor@ / ravi@demo.bolpay.app. `supabase/seed.sql` recreates them.
- Checks: build, lint, `npm run test:voice` 40/40, role access test 21/21.
- **Next:** see the status note at the top of `docs/REMAINING.md` (P0s left: A-00 key rotation, P-01..P-03 webhooks and failure tests, V-01 real mic test, S-02..S-08 submission, G-01/G-02 pitch).

## 1. What this project is

**BolPay** ("bol" = "speak" in Hindi) is a hackathon project (PayPal hackathon), a **voice-first payroll app for small businesses with daily-wage workers** (shops, kitchens, construction crews, packing units).

**Real-life problem:** owners track attendance in paper notebooks, remember overtime from memory and pay in cash. This causes wage disputes, wastes the owner's time, and leaves workers with no income record (so they can't get loans or credit).

**Product goal:** the owner never fills a form. They speak in any language:
- "Ravi aaj aaya, Anita ne 2 ghante overtime kiya" (Ravi came today, Anita did 2 hours overtime). The app understands it, records it and **speaks back a confirmation**.
- "Pay everyone for this week". The app calculates wages, overtime and incentives and **sends real PayPal (sandbox) payouts** in one batch.
- Workers log in and see their own attendance, earnings and payout history (proof of income).

**Target 90-second demo:** speak in Hindi → spoken confirmation (ElevenLabs) → "pay everyone" → PayPal sandbox payouts go out → open the worker's sandbox account to show the money arrived.

**Caveat:** PayPal stopped domestic payments within India (2021), so frame the pitch as US small businesses (e.g. Spanish-speaking crews) or "any PayPal-supported country", with Hindi or Spanish as the demo language. Use USD in sandbox.

## 2. Current state of the code (as of 2026-11-11)

- **Stack:** Next.js **16.4.3** (App Router, Turbopack), React 19.3, Tailwind 4, TypeScript. Node 24.
- **IMPORTANT:** read `AGENTS.md`. This Next.js version has breaking changes, so read the relevant guide in `node_modules/next/dist/docs/` before writing Next.js code.
- `npm install` is done and `npm run build` passes. Run with `npm run dev` → http://localhost:3000.
- **Pages** (`app/(merchant)/`): `/dashboard`, `/workers`, `/attendance`, `/incentives`, `/payouts`, `/transactions`. There is also `/checkout` (customer PayPal checkout, not related to the core idea, so remove or hide it).
- **All data is mock and client-side only:** `app/lib/merchant/mock-data.ts` seeds `app/lib/merchant/store.tsx` (React context). Nothing is saved. "Today" is hard-coded to `2026-11-03`.
- **Types:** `app/lib/merchant/types.ts`. **Pay calculation:** `app/lib/merchant/incentives.ts`.
- **Voice:** `app/components/merchant/VoiceAssistant.tsx` records audio → `POST /api/voice-input` → ElevenLabs speech-to-text (`app/lib/elevanlabs/client.ts`) → `app/lib/merchant/voice-commands.ts`, a **keyword/regex parser, English only**. It only handles: mark present/absent/half/leave, overtime hours, units completed, approve/reject payouts, navigate to pages. It can't answer questions or handle other phrasing or languages.
- **PayPal:** `app/lib/paypal/client.ts` + `order.ts` + `POST /api/paypal` create **checkout orders only**. "Approve payout" in the UI just changes a status label. **No PayPal Payouts API call exists yet.**
- **No backend database, no auth, no RBAC.**
- `docs/PRD.md` is empty.

## 3. Environment (`.env.local`, git-ignored, already filled in, NEVER print or commit values)

Verified working:
- `NEXT_PUBLIC_PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `NEXT_PUBLIC_PAYPAL_ENVIRONMENT=sandbox`: sandbox OAuth works, and order creation works.
- `ELEVEN_LABS_API_KEY`: works for speech-to-text (the key lacks `models_read`, which is fine; check it also has text-to-speech access).
- `GROQ_API_KEY`: valid. Not used in code yet. Default model `openai/gpt-oss-120b` (`GROQ_MODEL` optional).
- Also present (optional, mostly empty): `PAYPAL_WEBHOOK_ID`, `PAYOUT_CURRENCY=USD`, `ALLOW_LIVE_PAYOUTS` (payouts must be refused in production unless `"true"`), `ELEVEN_LABS_VOICE_ID`, `ELEVEN_LABS_TTS_MODEL`.

Must be added by the user (check that they exist, without printing values):
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or publishable key), `SUPABASE_SERVICE_ROLE_KEY` (or secret key).

## 4. Tooling already set up

- **Supabase MCP** in `.mcp.json` (project ref `mdarlwjrnmuvyhahmlqa`, features: docs, database, debugging, development, functions). The user should have approved and authenticated it via `/mcp`. **First, confirm the Supabase MCP tools are available.** If not, tell the user to run `/mcp` → supabase → Authenticate.
- **Skills installed** in `.claude/skills/`: `supabase` and `supabase-postgres-best-practices`. **Load both before any database or auth work.**

## 5. Decisions already made

- **Database + auth:** Supabase (Postgres + Supabase Auth + Row Level Security). No separate server; use Next.js route handlers / server actions with `@supabase/ssr`.
- **Roles (RBAC enforced with RLS, not only in the UI):**
  - **owner:** everything (workers, wages, incentive rules, approve and send payouts).
  - **supervisor:** mark attendance, overtime and units (incl. by voice). Cannot approve or send money.
  - **worker:** read-only access to their own attendance, earnings and payouts.
- **Tables (proposed, refine as needed):** `businesses`, `members` (user ↔ business ↔ role), `workers` (name, role/job, daily_wage, payout_email, status, optional link to auth user), `attendance` (worker, date, status, overtime_hours, units; one row per worker per day), `incentive_rules`, `payouts` (period, amount, status, paypal_batch_id, paypal_item_id), `voice_logs` (transcript, parsed intent, result: audit trail).
- Money-moving actions (sending payouts) run **server-side only**, check the owner role, and keep the `ALLOW_LIVE_PAYOUTS` safety switch.

## 6. Tasks for this session, in order

1. **Verify setup:** Supabase MCP connected, skills loaded, Supabase env vars present.
2. **Database:** create the schema as migrations through the Supabase MCP, with RLS policies for owner / supervisor / worker, indexes on foreign keys, and seed demo data matching `mock-data.ts` (Ravi Kumar, Anita Sharma, Mohammed Ali, Priya Nair, Carlos Mendez, Sunita Devi, Tom Becker [inactive]). Create 3 demo logins (one per role) and give the credentials to the user. Run the Supabase security advisor afterwards and fix the issues it reports.
3. **Auth + RBAC in the app:** login page, session handling with `@supabase/ssr`, protect the merchant routes, show and hide UI by role, and a worker view showing only their own data.
4. **Replace the mock store** with real Supabase reads and writes. Keep the existing UI and components as much as possible.
5. Then (next priorities, confirm with the user before starting):
   - Groq-powered voice understanding: free-form, multilingual commands and questions ("how many days did Ravi work?"), replacing or falling back to the regex parser.
   - ElevenLabs text-to-speech spoken confirmations.
   - Real PayPal **Payouts API** (sandbox) when the owner approves, with status sync.
   - Remove or hide `/checkout`.

## 7. Working rules

- Never print, log or commit secrets. Don't commit `.env*`.
- Only commit when the user asks. The branch is `main`, so make a feature branch first.
- After each step, run `npm run build` (and lint) to confirm nothing broke.
- Keep explanations to the user short and simple. They are building this for a hackathon and want a strong, demo-able product.

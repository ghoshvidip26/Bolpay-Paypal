# What is remaining

Updated 2026-11-07. Compares the code ([BUILT.md](./BUILT.md)) with the [PRD](./PRD.md) and the Devpost requirements.
**Deadline: 13 Nov 2026, 1:30 AM IST** (12 Nov, 12:00 PM Pacific). Plan to submit by the evening of 12 Nov IST.

Priority: **P0** = required to submit or to run the demo, **P1** = should have for a credible product, **P2** = nice to have.
Size: **S** under 1 hour, **M** a few hours, **L** a day or more. Owners follow the PRD team roles: Frontend, Backend, AI, Payments, Integration (QA, demo, slides).

## 1. PRD coverage at a glance

| PRD § | Requirement | Status | To-dos |
|---|---|---|---|
| 5.1 | Authentication, roles, business scoping | **Missing** | A-01 to A-05 |
| 5.2 | Workforce management (add, view, history, payment account) | Mostly done | U-04, U-05, D-05 |
| 5.3 | Voice interface (Scribe, languages, clarify, TTS) | Done for English, Hindi, Hinglish; browser mic untested | V-01 to V-10 |
| 5.4 | AI intent processing, validation, no LLM money | **Done**, 40 of 40 eval fixtures | V-11, V-12 |
| 5.5 | Incentive engine (tiers, versions, Needs Review, ₹) | Done with simplifications | D-01 to D-06 |
| 5.6 | Payout batch and approval | Done; batch-level view missing | U-02, D-03 |
| 5.7 | PayPal Payouts, statuses, webhooks, reconciliation | Payouts verified; **webhooks and reconciliation not** | P-01 to P-09 |
| 5.8 | Voice payout status updates | **Done** | V-06 |
| 6 | End-to-end flow | Works locally, not yet rehearsed from a clean clone | S-06, G-02 |
| 8 | Architecture (Express + Postgres + Prisma) | **Differs**: Next.js route handlers + JSON file | B-01 |
| 9 | MVP must-haves | All present except demo auth | A-01 |
| 10 | Security and reliability | Partial | A-01 to A-08 |
| 11 | Success metrics | Demonstrable | G-02 |

## 2. Critical path to submission (suggested order)

| When (IST) | Do | IDs |
|---|---|---|
| Today, Nov 7 | Rotate exposed keys, pick a LICENSE, decide the database, branding rename | A-00, S-01, B-01, T-01 |
| Nov 8 | Demo authentication, role guard on money endpoints, webhook + public URL, microphone test on real hardware | A-01, A-02, P-01, V-01 |
| Nov 9 | Hosted demo (if Postgres chosen) or tunnel plan, payment reconciliation, audit log screen | B-01, P-04, U-06 |
| Nov 10 | Unit tests and CI, remaining language tests, polish and empty/error states | Q-01 to Q-04, V-02, U-08 |
| Nov 11 | Demo script rehearsal, record the video, slides, Devpost write-up | S-04, S-05, G-01 to G-04 |
| Nov 12 | Final run from a clean clone, make repo public, submit with margin (not at the last minute) | S-06, S-07, S-08 |

## 3. Backlog

### S. Submission and hackathon (all mandatory unless marked)
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| S-01 | P0 | S | Integration | **LICENSE file** in the repo root (team picks MIT or Apache-2.0); it must show in GitHub's About section. |
| S-02 | P0 | S | Integration | **Make the repo public** and confirm it contains all source and assets and no secrets (`git log -p` search for keys; `.env` is ignored). |
| S-03 | P0 | S | Integration | **README for judges:** a clean clone runs after `npm install`, `.env`, `npm run dev`. Include the PayPal sandbox setup and a "demo mode" note. Test on a second machine. |
| S-04 | P0 | M | Integration | **Demo video**, under 3 minutes, on YouTube, public. Show the voice → plan → approve → PayPal → status flow on the device it was built for. No copyrighted music or third-party trademarks (check logos of PayPal, ElevenLabs, Groq on screen; use the sponsor naming only as text if unsure). |
| S-05 | P0 | M | Integration | **Devpost text description:** features, the problem, who it is for, how AI and PayPal are used, what was built during the hackathon vs before (the repo has commits from before the 1 Oct start; Devpost requires an explanation of significant changes). |
| S-06 | P0 | S | Integration | **Functional demo requirement:** either a hosted URL or exact run instructions. Judges must be able to run it; put seeded data and sandbox credentials guidance in the README. |
| S-07 | P0 | S | Integration | **Tools list:** ElevenLabs Scribe and TTS, Groq `gpt-oss-120b` and `gpt-oss-20b`, PayPal Payouts REST API, PayPal Orders SDK, Next.js, Tailwind. State how each is used (README has a draft). |
| S-08 | P0 | S | Integration | Submit on Devpost with margin; re-read the official Rules page (never read directly, only the overview) for anything extra. |
| S-09 | P1 | M | Integration | **Hosted demo on Render** (also the Render prize): needs B-01 (Postgres) or a persistent disk. Add `render.yaml`. |
| S-10 | P1 | S | Backend | **Postman collection** for the API and webhook flow (Postman prize area); export to `docs/postman/`. |
| S-11 | P2 | M | Backend | **OpenAPI spec** for `/api/*` (APIMatic prize area; also helps judges). |
| S-12 | P2 | M | Frontend | **AG Grid** for the workers, attendance and transactions tables (three AG Grid prize slots). |
| S-13 | P2 | S | Integration | Pitch angles for the special awards: "Best Use of Agentic Commerce" (voice agent plans, human approves, PayPal pays) and "Most Impactful" (workers get paid correctly and fast). |

### A. Authentication, authorization, security
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| A-00 | **P0** | S | You | **Rotate secrets that appeared in the chat:** the Groq API key, the PayPal sandbox secret (and NVP password/signature if used). Update `.env`. |
| A-01 | P0 | M | Backend | **Demo login** (manager, admin) with a signed session cookie; every `/api/*` route except webhook and health needs it. Acceptance: unauthenticated requests get 401. |
| A-02 | P0 | S | Backend | **Role guard on money endpoints:** approve, reject, retry, sync, import, and the voice turn when it contains a money step. Only the admin role approves; managers can prepare. |
| A-03 | P1 | M | Backend | **Business scoping:** a `businessId` on workers, payouts, transactions; all queries filtered by the session's business. |
| A-04 | P1 | S | Backend | Rate limit `/api/voice/*`, `/api/voice-input`, `/api/voice-output`, `/api/import` (cost and abuse protection for paid APIs). |
| A-05 | P1 | S | Backend | Validate and cap request bodies everywhere (voice routes already do; check `/api/workers`, `/api/attendance`, `/api/rules`). |
| A-06 | P1 | S | Backend | Security headers in `next.config.ts` (CSP, X-Frame-Options, Referrer-Policy). |
| A-07 | P1 | S | Backend | Confirm no recipient emails or phone numbers reach the LLM or spoken replies (the planner prompt already excludes them; add a test). |
| A-08 | P2 | M | Backend | Audit log must record the **actor** (user) once auth exists; make entries append-only. |
| A-09 | P2 | S | Backend | Production guard: refuse to start with `NEXT_PUBLIC_PAYPAL_ENVIRONMENT=production` unless `ALLOW_LIVE_PAYOUTS` is explicitly set (the payout path already blocks; the startup check makes it visible). |

### P. Payments and PayPal
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| P-01 | P0 | M | Payments | **Webhooks end to end:** public HTTPS URL (ngrok or Render), register the webhook on the app, set `PAYPAL_WEBHOOK_ID`, send a real payout, observe `PAYMENT.PAYOUTS-ITEM.*` update the transaction without clicking sync. |
| P-02 | P0 | S | Payments | **Invalid-signature test:** a forged POST to `/api/webhooks/paypal` returns 400 and changes nothing. |
| P-03 | P0 | S | Payments | **Failure and pending scenarios:** use PayPal's negative-testing tool for a failed payout and an unclaimed one (recipient with no account). Confirm the statuses and messages shown (PRD §11: failed, pending, successful). |
| P-04 | P1 | M | Backend | **Reconciliation:** a screen or action comparing internal transactions with PayPal batch items; flag mismatches (status, amount, missing item). |
| P-05 | P1 | S | Backend | Map `UNCLAIMED`, `ONHOLD`, `RETURNED`, `BLOCKED` to distinct, explained states (today they collapse into processing or failed). Add a "claim by" note for unclaimed. |
| P-06 | P1 | S | Backend | Handle batch-level webhook events (`PAYMENT.PAYOUTSBATCH.*`) and insufficient-funds errors with a clear message. |
| P-07 | P1 | S | Backend | Show the PayPal batch id and item id on the transaction (a link to the sandbox transaction is a bonus). |
| P-08 | P1 | S | Payments | Duplicate-payout test: approve the same payout from two tabs; exactly one PayPal item is created. |
| P-09 | P2 | S | Backend | Settlement currency options: keep ₹ display with USD settlement, or document INR availability once confirmed (PayPal blocked the India sender account). Make the rate visible in the UI footer. |
| P-10 | P2 | M | Backend | Optional: use PayPal's Orders flow meaningfully (for example, the merchant tops up the payout balance via `/checkout`) or remove the unused checkout page (see T-03). |
| P-11 | P2 | S | Payments | Use the Webhook Simulator for non-payout events to confirm they are ignored safely. |

### V. Voice and AI
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| V-01 | P0 | S | AI | **Real microphone test** in Chrome on the demo machine: tap, speak, tap; transcript, plan, spoken confirm, checkpoint, payout. Record issues. (Only typed commands and generated audio were tested.) |
| V-02 | P1 | M | AI | **Kannada, Tamil, Bengali tests:** generate speech (ElevenLabs), run through Scribe and the planner; add fixtures; check reply translation and TTS quality. |
| V-03 | P1 | S | AI | **Code-mixed speech** samples (Hinglish done; add Kanglish, Tanglish) to the eval. |
| V-04 | P1 | M | AI | **Speech-to-text robustness:** names mis-transcribed ("Ravikumar", "Anita Sharma" as "Anita Sharma ji"). Add phonetic or fuzzy name matching in `matchWorker`, with a confirm when confidence is low. |
| V-05 | P1 | S | AI | Pass the spoken language to Scribe when known (it auto-detects today) and keep the language for the TTS voice choice. |
| V-06 | P1 | S | AI | Never speak emails or account details; add an eval fixture for "what is Ravi's PayPal email" (should refuse or give a masked answer). |
| V-07 | P1 | M | AI | **Same-sentence dependencies:** allow a step to refer to a worker created earlier in the same flow (add rider, then mark him present), by re-resolving at execution time. |
| V-08 | P1 | M | AI | **Groq limits:** handle the 8,000 tokens per minute cap more gracefully (queue and retry with a spoken "one moment", cache plans for repeated queries) or move to a paid key; keep the failover. |
| V-09 | P2 | M | AI | **Hands-free mode** (auto-listen after a spoken question) with echo protection and silence detection, behind a toggle. Needs real-device testing. |
| V-10 | P2 | S | AI | **Per-step results spoken:** for long flows, speak a short summary and show the detail on screen (cap is 400 characters per TTS call). |
| V-11 | P2 | S | AI | Persist voice sessions and metrics (today in memory: lost on restart, not shared across instances). |
| V-12 | P2 | M | AI | More actions: reopen or resubmit a rejected payout by name, list audit entries, export a report, set the pay period, undo the last attendance change. |
| V-13 | P2 | S | AI | Prompt regression guard: run `npm run test:voice` in CI against a mock model, or record and replay model outputs. |

### D. Data, rules engine, workforce
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| D-01 | P1 | L | Backend | **Daily incentive batches:** a batch that pays only a day's tier bonus (PRD example "₹100 for riders with at least 20 deliveries today"). Today the filter selects riders, who then receive the full period amount. |
| D-02 | P1 | M | Backend | **Separate delivery records** (order id, timestamp, city) feeding units per day, instead of one number on the attendance row; support conflicting duplicates. |
| D-03 | P1 | M | Backend | **Status model:** add Draft and a separate Approved step (payout approved, then submitted); batch entity grouping payouts, with a batch screen (total, count, flagged workers, rule version). |
| D-04 | P1 | S | Backend | **Needs Review actions:** "mark reviewed, approve anyway" with a reason (audited), plus "fix attendance" deep link. |
| D-05 | P1 | M | Backend | **Rule history:** store every rules version (not only per-payout snapshots), a screen to view and compare versions. |
| D-06 | P1 | S | Backend | **Pay periods:** `TODAY` and the period are constants (`2026-11-03`). Add period selection and close, or read the real date with a demo override. |
| D-07 | P2 | S | Backend | Worker payout history screen and a worker payout statement (PRD §4 worker persona, §9 nice-to-have). |
| D-08 | P2 | M | Backend | Additional rule types (per-city multipliers, weekly bonuses, penalties) and rule effective dates. |
| D-09 | P2 | S | Backend | Timezone handling for dates (IST vs UTC) in `formatDate` and attendance. |

### U. Frontend and UX
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| U-01 | P0 | S | Frontend | **Branding:** the UI, page titles, PayPal payout email and batch prefix still say "PayCrew". Rename to BolPay with tagline "Speak. Approve. Pay.", favicon and logo. |
| U-02 | P1 | M | Frontend | Batch review screen: totals, flagged workers, rule version, USD settlement, in one view (PRD §5.6). |
| U-03 | P1 | S | Frontend | Loading, empty and error states on every screen; global error boundary; a visible banner when the server or model is unavailable. |
| U-04 | P1 | S | Frontend | Worker detail page: attendance history, payout history, payment account status (masked email). |
| U-05 | P1 | S | Frontend | Edit worker city, role, phone and PayPal email inline (only wage is inline today). |
| U-06 | P1 | S | Frontend | **Audit log screen** with filters and CSV download (entries are stored, never shown). |
| U-07 | P1 | M | Frontend | Responsive layout check for mobile (managers use phones); the voice panel on small screens. |
| U-08 | P1 | S | Frontend | Accessibility pass: focus order, labels, contrast, keyboard use of the voice panel; screen-reader announcements for plan changes. |
| U-09 | P2 | M | Frontend | Dashboard analytics: payout trend, per-city totals, on-time rate (PRD §9 nice-to-have). |
| U-10 | P2 | S | Frontend | Downloadable payout report (CSV and PDF) for a period. |
| U-11 | P2 | M | Frontend | UI language switcher (English, Hindi, Kannada, Tamil, Bengali). |
| U-12 | P2 | S | Frontend | Show the plan's money checkpoint as a modal with big amounts, for the demo. |

### B. Backend, persistence, infrastructure
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| B-01 | P0 (decision) | L | Backend | **Database decision.** Option A: keep the JSON file, state the limitation, demo locally, record the video. Option B: Postgres + Prisma behind the existing service layer (enables Render hosting and the Render prize). The service API already isolates storage, so only `db.ts` and the service functions change. |
| B-02 | P1 | M | Backend | If Postgres: Prisma schema (merchants, workers, attendance, deliveries, rule versions, payout batches, payouts, transactions, audit), migrations, seed script. |
| B-03 | P1 | S | Backend | Concurrency: the JSON store has no locking. At minimum serialise writes in one process; document the single-instance limit. |
| B-04 | P1 | S | Backend | Health endpoint and structured logging (request id, no secrets). |
| B-05 | P2 | S | Backend | Backup and restore for the JSON file (`.data_backup/` appeared untracked at one point; ignore it in `.gitignore`). |
| B-06 | P2 | M | Backend | Background sync job so processing payments settle without a browser open. |

### Q. Quality and testing
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| Q-01 | P1 | M | Backend | **Unit tests** (Vitest or node:test) for `calculatePay` (tiers, overtime, bonus, rounding), `reviewReasons`, `submitPeriod` filters and resubmit, `previewMoney`, CSV parser, selectors. |
| Q-02 | P1 | S | Backend | **CI** (GitHub Actions): install, `tsc --noEmit`, lint, unit tests on each push. |
| Q-03 | P1 | M | Integration | **End-to-end browser test** (Playwright) for approve and sync with the PayPal sandbox, and for the voice panel with typed commands. |
| Q-04 | P1 | S | Integration | Run the full manual script in [VOICE.md](./VOICE.md) and [DEMO.md](./DEMO.md) and tick every box. |
| Q-05 | P2 | S | AI | Extend `test:voice` fixtures (Kannada, Tamil, Bengali, more injections, money flows with real checkpoints against a seeded state). |
| Q-06 | P2 | S | Integration | Load check: 25 riders × 14 days is small; test 500 workers for the import and the tables. |

### G. Documentation and presentation
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| G-01 | P0 | M | Integration | **Demo script and fallback recording** (rehearse twice; keep a pre-recorded run in case of network failure). |
| G-02 | P0 | M | Integration | **Slides and pitch** (PRD team role 5): problem, solution, live flow, safety model (human approval, exact amounts), market, what is next. |
| G-03 | P1 | S | Integration | Architecture diagram image in the README (voice turn flow from [VOICE.md](./VOICE.md), payout flow). |
| G-04 | P1 | S | Integration | Fill the gaps in the PRD (see §15 of [PRD.md](./PRD.md): extended requirements). |
| G-05 | P2 | S | Backend | API reference generated from the OpenAPI spec (S-11). |
| G-06 | P2 | S | Integration | A short "What we learned / limits" section for the Devpost write-up (rate limits, sandbox currency, India account block). |

### T. Cleanup and technical debt
| ID | Pri | Size | Owner | Task and acceptance |
|---|---|---|---|---|
| T-01 | P0 | S | Frontend | Rename PayCrew to BolPay everywhere (see U-01), including `sender_batch_id` prefix and the PayPal email subject. |
| T-02 | P1 | S | Backend | Remove dead code: `/api/intent`, `app/lib/ai/intent.ts` (single-intent path: keep `groqChat`), `voice-commands.ts`, `intent-types.ts` pieces still used only by them. |
| T-03 | P1 | S | Frontend | The `/checkout` page uses a placeholder `"guest"` user and is not part of the main flow; integrate (P-10) or remove. |
| T-04 | P1 | S | Backend | Remove unused `i` and `npm` dependencies from `package.json`. |
| T-05 | P1 | S | Backend | Rename the `app/lib/elevanlabs` folder (typo) to `elevenlabs`. |
| T-06 | P2 | S | Backend | Add `.gitattributes` (LF normalisation; git warns about CRLF on every commit), and ignore `.playwright-mcp/`, `.data_backup/`. |
| T-07 | P2 | S | Backend | `next.config.ts`: confirm no experimental flags are needed for production; check `next build` succeeds (not run in this session). |
| T-08 | P2 | S | Backend | **Run `next build`** and fix anything the dev server hid (the Turbopack stale-module issue only shows in dev). |

## 4. Risks and open decisions

| Risk or decision | Impact | Mitigation |
|---|---|---|
| Groq free-tier limit (8,000 tokens per minute per model) | Rapid voice turns can stall during a live demo | Failover is built; rehearse at normal pace; consider a paid key; keep a typed fallback |
| PayPal sandbox only; India sender account blocked | Judges see USD in PayPal while the UI shows ₹ | Say so in the pitch; fixed rate in `.env` |
| JSON database | Not for hosted or multi-user use | B-01 decision |
| No auth | Anyone reaching the app can approve payouts | A-01, A-02 before any public URL |
| Browser microphone untested | Demo-day surprise | V-01 early, on the demo machine |
| Webhooks untested | PRD requires verified webhooks | P-01, P-02 |
| Repo is a teammate's, history predates the hackathon | Devpost asks what changed since 1 Oct | S-05 |
| Turbopack stale modules in dev | Confusing errors after edits | Restart the dev server after server-side edits; use a production build for the video |

## 5. Sandbox housekeeping
- Riders 5 to 24 have sandbox personal accounts (bulk upload done); rider 25 deliberately has no email (failure demo); rider 24 is inactive.
- A full-team batch costs about **$2,470** of sandbox money; the business balance was topped up to US$100,000. Check the balance before recording.
- Reset the data before the video: stop the server, delete `.data`, start again.

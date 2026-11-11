# BolPay AI — Speak. Approve. Pay.

A voice-first workforce payout app. A manager speaks a command in their own language, the system turns it into a validated action, a deterministic rules engine calculates pay, and money moves through the **PayPal Payouts API (sandbox)** only after explicit human approval.

Built for the PayPal AI Hackathon 2026.

- Product spec: [docs/PRD.md](docs/PRD.md)
- What works today: [docs/BUILT.md](docs/BUILT.md)
- What is left: [docs/REMAINING.md](docs/REMAINING.md)
- Voice control (architecture, testing, manual script): [docs/VOICE.md](docs/VOICE.md)

## How AI is used
| Tool | Used for |
|---|---|
| ElevenLabs Scribe | Speech-to-text for voice commands |
| Groq LLM (`openai/gpt-oss-120b`, falling back to `gpt-oss-20b`) | Plans an ordered list of steps from the transcript, follows up on missing details, and translates replies. It never calculates amounts and never decides to execute. |
| ElevenLabs TTS | Spoken replies and payout status updates |

The server validates every model output and resolves workers and dates itself. The rules engine in `app/lib/merchant/incentives.ts` is the only source of pay amounts.

## Run it
Requirements: Node 20+, and sandbox credentials for PayPal, ElevenLabs and Groq.

```bash
npm install
cp .env.example .env     # then fill in the keys (instructions are in the file)
npm run dev              # http://localhost:3000
```

### Sign in (roles)
Login uses Supabase Auth; set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env`. The demo logins (password `BolPayDemo#2026`, also one-click buttons on `/login`):

| Login | Role | Can do |
|---|---|---|
| `owner@demo.bolpay.app` | Owner | Everything: workers, wages, rules, approve and send payouts |
| `supervisor@demo.bolpay.app` | Supervisor | Mark attendance (also by voice), prepare payouts. Cannot approve or move money |
| `ravi@demo.bolpay.app` | Worker (Ravi Kumar) | Only their own attendance, earnings and payment history (`/me`) |

Every `/api/*` route checks the role on the server (the PayPal webhook is verified by signature instead), and the voice assistant refuses owner-only steps for a supervisor. To recreate the logins in a new Supabase project, apply `supabase/migrations/*.sql`, then run `supabase/seed.sql` in the SQL editor.

### PayPal sandbox setup
1. At developer.paypal.com create a **US Business** sandbox account (Testing Tools → Sandbox Accounts). Business accounts from some countries, e.g. India, cannot send payouts.
2. Create an app for it (Apps & Credentials), keep **Payouts** enabled, and copy the Client ID and Secret into `.env`.
3. Create US **Personal** sandbox accounts for the workers. The seed data expects `bolpay-worker-1@personal.example.com` … `bolpay-worker-24@personal.example.com`; otherwise edit the PayPal email on the Workers screen.
4. Amounts are shown in ₹ and settled in USD at `INR_PER_USD` (default 85).

### Try the demo flow
1. **Attendance / Workers:** look at the 25 seeded Bengaluru riders. You can add riders or import CSVs (Workers screen).
2. **Incentives:** review the tiered rules (10 / 20 / 30 deliveries → ₹50 / ₹100 / ₹150) and submit the period.
3. **Payouts:** riders with missing or conflicting records are under **Needs review**. Approve a few of the rest; each batch is sent to PayPal.
4. **Transactions:** statuses refresh automatically (or via sync) from *processing* to *completed*. A rider with no PayPal email fails with a reason and can be retried.
5. **Voice:** click the microphone and say, e.g. "Calculate incentives for all Bengaluru riders who completed at least 20 deliveries today", then confirm. Ask "how many payments failed?" for a spoken status.

To reset the data, stop the server and delete the `.data` folder.

## Commands
`npm run dev` · `npm run build` · `npm run start` · `npm run lint` · `npm run test:voice` (needs the dev server running; signs in as the demo owner)

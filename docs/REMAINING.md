# What is remaining

Updated 2026-11-07. Gaps between the code ([BUILT.md](./BUILT.md)) and the [PRD](./PRD.md). Deadline: **13 Nov 2026, 1:30 AM IST**.

## Needs a team decision
- **Database:** Postgres + Prisma, or keep the JSON file and state the limitation. Postgres is needed for a Render hosted demo (and the Render prize). Next.js route handlers already replace Express.
- **LICENSE:** the repo must be public and open source with a visible LICENSE. No file exists yet. MIT or Apache-2.0 are the usual choices; the team has to pick.
- **Auth and roles (PRD §5.1):** none yet. Anyone who can reach the app can approve payouts. Needs at least demo login plus manager/admin roles on the approve, reject, retry, sync and import endpoints.

## Submission deliverables (all mandatory)
- [ ] Public repo and LICENSE.
- [ ] README with run instructions that judges can follow (rewritten; double-check from a clean clone).
- [ ] Text description and the tools list (ElevenLabs Scribe + TTS, Groq model, PayPal Payouts + Orders) with how each is used.
- [ ] Demo video under 3 minutes on YouTube, showing the full voice → approve → pay → status flow, with no copyrighted music or third-party trademarks.
- [ ] Hosted demo URL (optional if the README setup works), or at least a rehearsed local run.

## Product gaps
1. **Webhooks:** register a public URL (ngrok or Render), set `PAYPAL_WEBHOOK_ID`, test valid and invalid signatures. Sync works without it.
2. **Per-day incentive batches:** the voice filter "at least 20 deliveries today" selects qualifying riders, but each gets the full *period* amount. A true daily incentive batch (only that day's tier bonus) is not modelled.
3. **Status model:** payouts have pending / needs_review / approved / rejected, and transactions have processing / completed / failed. The PRD's Draft and Approved-as-separate-step states are not separate.
4. **Fix-and-resubmit for Needs Review** works by editing attendance and submitting again; there is no "mark reviewed, approve anyway" action.
5. **Languages:** English and Hindi were tested. Kannada, Tamil, Bengali and code-mixed speech are untested.
6. **Audit log UI:** entries are recorded but not displayed or downloadable.
7. **Browser microphone path:** server chain is verified; the in-browser recording button has not been exercised by me.
8. **Currency:** ₹ display with a fixed USD settlement rate (`INR_PER_USD`). Fine for a sandbox demo; say so in the pitch.
9. **No automated tests.** At least the incentive engine (tiers, overtime, bonus) and `submitPeriod` filters deserve unit tests.
10. Nice-to-haves: worker payout statements, downloadable reports, payout analytics, language switcher, AG Grid tables (sponsor prize).

## Sandbox housekeeping
- Upload `bolpay-sandbox-workers-5-24.csv` (bulk account creation) so riders 5–24 have real sandbox recipients. Until then payouts to them stay unclaimed or pending.
- Each full-team batch costs about **$2,470** from the sandbox business balance (₹210k at ₹85/$). Approve only a few riders when rehearsing, or top the account up in the sandbox dashboard.
- Remove unused `i` and `npm` entries from `package.json`.

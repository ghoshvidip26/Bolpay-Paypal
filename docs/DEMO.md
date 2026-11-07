# Manual testing and demo guide

Everything here runs against the **PayPal sandbox**. No real money moves.

## 0. Start from a clean state
The database holds my earlier test payouts (riders 1, 2 and 25). To start fresh:

```powershell
# stop `npm run dev` (Ctrl+C), then:
Remove-Item -Recurse -Force .data
npm run dev
```

On the next request the app reseeds: 25 Bengaluru riders, rules v1, no current-period payouts. Open http://localhost:3000 in **Chrome** (the microphone needs a secure origin, and localhost counts).

Fixed demo date: the app's "today" is **3 Nov 2026**, and the current pay period is **21 Oct – 3 Nov 2026**. Dates are in `app/lib/merchant/mock-data.ts` (`TODAY`, `CURRENT_PERIOD`).

## 1. What is happening, step by step

| Step | What you do | What the system does |
|---|---|---|
| 1. Data | Workers / Attendance screens | Riders, attendance and deliveries ("units") are the only inputs. They are stored in `.data/db.json`. |
| 2. Calculate | Incentives screen, or the voice command "prepare" | The **rules engine** (`app/lib/merchant/incentives.ts`) computes base pay, overtime, per-unit incentive, daily delivery tiers and the attendance bonus. The AI never computes money. |
| 3. Check | Automatic on submit | Missing attendance days or an "absent but has deliveries" record flag the payout **Needs review**. Those can't be approved. |
| 4. Approve | Payouts screen (or voice) | Only `pending` payouts can be approved. Approving creates a transaction per rider, converts ₹ → USD at ₹85/$, and sends **one PayPal Payouts batch** with an idempotent batch ID. |
| 5. Track | Transactions screen | The page polls PayPal every 4 s while anything is *processing*. Statuses go processing → completed, or failed with a reason. Failed ones can be retried (new batch ID). |
| 6. Voice | Round button, bottom-right | Mic audio → ElevenLabs Scribe → text → Groq LLM extracts an intent → the server validates it and resolves the rider and date → you see a plan and press **Confirm** → ElevenLabs speaks the reply. |

## 2. What to tweak, and where

| To change | Where |
|---|---|
| Delivery tiers, overtime multiplier, bonus, attendance threshold | **Incentives** screen, bottom card, then **Apply**. This bumps the rules version, and each payout records the version it used. |
| A rider's wage, city or PayPal email | **Workers** screen. Click the wage to edit it; use **Add worker** for new riders. The PayPal email must be a real sandbox account. |
| Attendance, deliveries and overtime | **Attendance** screen: pick the date, set the status buttons, overtime hours and units done. |
| Many riders or many days at once | **Workers → Import workers CSV / Import deliveries CSV**. Workers: `name, role, city, phone, payoutEmail, dailyWage`. Deliveries: `worker, date, deliveries, status, overtime`. |
| ₹ → USD rate | `INR_PER_USD` in `.env` (default 85), then restart the server. |
| Which PayPal account pays | `NEXT_PUBLIC_PAYPAL_CLIENT_ID` and `PAYPAL_CLIENT_SECRET` in `.env`. It must be a **US** business sandbox app with Payouts enabled. |
| Voice, voice ID, LLM | `ELEVEN_LABS_VOICE_ID`, `ELEVEN_LABS_TTS_MODEL`, `GROQ_MODEL` in `.env`. |
| Seed riders, deliberate data problems | `app/lib/merchant/mock-data.ts`. After changing it, bump `SCHEMA_VERSION` in `app/lib/server/db.ts` or delete `.data`. |

Deliberate seed problems: riders **7 and 13** are missing attendance days, rider **18** is marked absent with 14 deliveries, and rider **25 (Carlos D'Souza)** has no PayPal email, so his payout fails on purpose.

## 3. Manual test checklist (about 15 minutes)

1. **Dashboard** loads with the period and stat cards. No red error banner.
2. **Workers:** 25 riders, all in Bengaluru, rider 25 shows "Missing" under PayPal. Filter by city. Import a 2-row workers CSV and check the rows appear, then re-import it and check "already exists" is reported.
3. **Attendance:** open 3 Nov. Change rider 1 to Absent and back to Present with 25 units.
4. **Incentives:** the table has a Delivery tiers column. Change a tier bonus (₹100 → ₹120), click **Apply**, and check totals change and the version goes to v2. Click **Submit … for approval**. The banner should say how many are submitted and how many are Needs Review.
5. **Payouts:** the **Needs review** card lists riders 7, 13 and 18 with reasons. In **Awaiting approval**, expand **Details** on a rider: it shows the breakdown and rules version.
6. **Approve a few, not all.** Select riders 1 to 4 (their sandbox accounts exist) and click **Approve selected → Yes, approve**. All 21 riders would cost about $2,470 of sandbox money. The balance is large, but you don't need it.
7. **Transactions:** rows show *processing*, then *completed* within about a minute, with ₹ and "$… via PayPal". Click sync-free: the page updates itself.
8. **Failure and retry:** approve rider 25 (no email). It fails with "Worker has no valid PayPal account on file". On **Workers**, give him `bolpay-worker-24@personal.example.com`, then press **Retry** on Transactions. It should complete.
9. **Needs review fix:** on Attendance, mark rider 7 present on 2 Nov, then **Incentives → Submit** again. Rider 7 moves to Awaiting approval.
10. **PayPal side:** log in at https://sandbox.paypal.com as `bolpay-worker-1@personal.example.com` (password from your bulk CSV, `J0nhD03!`). The payment is in Activity.

## 4. Voice flow
Click the round teal button (bottom-right) to open the panel.

1. Press **Tap and speak**, say the command, press again to stop.
2. The app transcribes, interprets and shows a plan card. Informational answers (status questions) appear directly with **Read aloud**. Actions show **Confirm / Cancel**.
3. After Confirm, the action runs and the reply is spoken (the speaker icon toggles voice replies). You can also type a command in the box.

**What to say (English)**

| Say | What happens |
|---|---|
| "Calculate incentives for all Bengaluru riders who completed at least twenty deliveries today." | Plan: prepare, city Bengaluru, ≥ 20 deliveries on 3 Nov. Confirm → qualifying riders appear on Payouts. |
| "Prepare payouts." | Submits everyone not yet submitted, including the Needs Review ones. |
| "Mark Ravi Kumar present today." | Plan: set attendance. Confirm to apply. |
| "Anita Sharma worked two hours overtime today." | Records overtime. |
| "Record twenty-five deliveries for Mohammed Ali." | Records units. |
| "Approve Ravi Kumar's payout." | Approves one pending payout and sends it to PayPal. |
| "How many payments failed?" / "What is the payout status?" / "Which workers have pending payments?" | Answered from the stored statuses and spoken back. |
| "Open transactions." | Navigates to that screen. |

**Hindi example:** "आज रवि कुमार को उपस्थित मार्क करो।" (Mark Ravi Kumar present today.) Replies come back in the language you spoke. Kannada, Tamil and Bengali are untested.

Avoid "approve all" while testing: it approves every pending payout.

## 5. Suggested demo script (under 3 minutes)
1. (10 s) One-line pitch. Dashboard on screen.
2. (30 s) Voice: "Calculate incentives for all Bengaluru riders who completed at least twenty deliveries today." Show the plan (city, threshold, date), **Confirm**.
3. (20 s) Payouts: point at the **Needs review** card (missing attendance, conflicting record), open **Details** to show tiers and the rules version.
4. (30 s) Approve riders 1 to 4. Say it plainly: "Nothing is paid until a human approves."
5. (30 s) Transactions: processing → completed. Show the ₹ amount with the USD amount PayPal received. Optionally show the PayPal sandbox activity.
6. (20 s) Voice: "How many payments failed?" and let it speak the answer. Show rider 25's failure and **Retry** after adding the email.
7. (20 s) Close with the architecture line: voice → validated plan → rules engine → human approval → PayPal Payouts → verified status.

Record a backup video of a clean run first, in case the network fails during judging.

## 6. If something goes wrong
- **"User business error" on approve:** a repeat of an earlier PayPal batch. **Retry** makes a new batch.
- **Payouts to riders 5 to 24 stay processing:** their sandbox accounts don't exist. Create them with the bulk CSV.
- **Voice says "not configured" (503):** a missing `ELEVEN_LABS_API_KEY` or `GROQ_API_KEY`. Restart the server after editing `.env`.
- **Mic button does nothing:** use Chrome, allow microphone access, and use `localhost`, not a LAN IP.
- **Weird state:** stop the server and delete `.data`.
- **Webhooks:** not set up. The page's polling replaces them.

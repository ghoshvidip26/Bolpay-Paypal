# Demo video: script, shot list and how to build it

Target: **2 minutes 55 seconds** (Devpost: under 3 minutes, public on YouTube, shows the project working). One narrator, plus the manager's spoken voice commands, which you can say live into the mic.

Everything below was checked against the running app: the three voice commands were run through the real planner in dry-run mode (they plan as written and a real run pauses at the exact-amount checkpoint), and every narration length was measured by generating the clips.

## 0. How the timing works (read this first)

The timecodes in section 4 come from real audio. I generated every clip with a stand-in voice (the premade Adam voice, model `eleven_v4`) to measure durations. **Your narrator voice (`sXcl1NoQHcU7NRh6Na5D`) could not be used by me:** it is an ElevenLabs *library* voice, and the API refuses library voices on the free plan (HTTP 402 for every model). So generate the final clips yourself (section 6). Your voice will differ from the stand-in by about ±10 percent.

Two rules make that harmless:
1. **Events drive the cuts, not the clock.** Record each screen block separately (section 5) and slide each narration clip so it starts when its visual appears (the "Starts when" column).
2. **After generating, re-measure** (the generator script prints each clip's length) and shift later clips by the difference. If the total passes 3:00, apply the trims in section 4.

## 1. The cast

| Voice | Who | Where it comes from |
|---|---|---|
| **Narrator** | The pitch voice-over | ElevenLabs, voice `sXcl1NoQHcU7NRh6Na5D`, model Eleven v4 (clips N1 to N10) |
| **Manager** | Gives the spoken commands to BolPay | You, live into the mic (best), or the ready-made clips in `demo-assets/audio/manager/` (premade voice Sarah, M1 to M4) |
| **BolPay** | The assistant's spoken replies | The app itself (ElevenLabs, set by `ELEVEN_LABS_VOICE_ID`), recorded from system audio |

## 2. Before you record: pre-flight checklist

**Data state (important: the numbers on screen depend on it)**
1. Demo data must be fresh: stop `npm run dev`, delete **only** `.data/db.json`, start it again. (Do **not** delete `.data/zoho.json` or `.data/integrations.json`: they hold your Zoho employees, the connection and the awaiting-sign-up payment.) After any rehearsal, repeat this.
2. Check on the Incentives page that rules are still **version 1** (tiers 10 / 20 / 30 → ₹50 / ₹100 / ₹150). Then Ravi Kumar's payout is **₹7,812.50 (US$91.91)** and Mohammed Ali's **₹9,403.75 (US$110.63)**, so the checkpoint shows **2 payments totalling ₹17,216.25 (US$202.54)**. If your numbers differ, the rules changed; the video works either way, since the narration never says a number.
3. Zoho must be connected with employees synced (Integrations page shows **Connected**). In the **Zoho HRMS** dataset, Transactions should show one **Awaiting PayPal sign-up** row (the payment to `ankrutisharma@gmail.com`). If it is gone, pay any employee whose email has no PayPal account.
4. PayPal sandbox business balance is funded (you raised it to US$100,000).

**Browser and accounts**
5. Sign in as the owner: `owner@demo.bolpay.app` / `BolPayDemo#2026`.
6. Chrome, 1920×1080, zoom 110 percent, bookmarks bar hidden, notifications off (Windows Focus Assist), one clean window.
7. Open two more windows ready and **already signed in**, so no passwords appear on camera: (a) https://sandbox.paypal.com as the business account `sb-f9idn53768044@business.example.com`, on **Activity**; (b) a private window signed in as `bolpay-worker-1@personal.example.com` (password `J0nhD03!` from the bulk CSV you uploaded), on **Activity**.
8. Microphone allowed for `localhost`. Voice replies **on** (speaker icon in the voice panel). Test once with "How many payments failed?" (read-only, changes nothing), then **New conversation**.
9. Recorder: OBS Studio, 1920×1080, 30 fps, **desktop audio and microphone on separate tracks**.

## 3. The script (what the narrator says)

Clip ids match `docs/demo-video/narration.json`. Square-bracket words are delivery directions for the Eleven v3/v4 family; if you hear one read aloud, delete the brackets and regenerate that clip. "Stand-in length" is the measured length with the stand-in voice.

| Clip | Narrator says | Stand-in length |
|---|---|---|
| **N1** | [calmly] Every pay cycle, a manager somewhere is stitching together attendance, deliveries, bonuses and bank details from spreadsheets and chat threads. It takes hours... and one wrong cell means someone gets paid wrong. | 13.7 s |
| **N2** | [warmly] This is BolPay. Speak. Approve. Pay. You say what you need, a rules engine does the maths, a human approves, and PayPal sends the money. | 10.4 s |
| **N3** | [confident] And you don't start from scratch. This is a real Zoho People account. One click, and every employee, and this month's attendance, flow into BolPay. No retyping. Pay settings stay in BolPay, so a re-sync never overwrites a wage. | 15.4 s |
| **N4** | [excited] Now the good part. The manager just talks, in one breath, and BolPay turns it into a plan. | 6.6 s |
| **N5** | Three steps, in order. Nothing has moved yet. | 3.7 s |
| **N6** | [emphasizing] Before a single rupee moves, it shows the exact total, in rupees and in dollars. Only a second confirm sends it. | 9.0 s |
| **N7** | Nothing is paid blindly. Riders with missing or conflicting records land in Needs Review, and can't be approved until someone fixes them. Owners approve. Supervisors record attendance. Workers see only their own pay. | 15.3 s |
| **N8** | [confident] And this is real. A live PayPal payouts batch, moving from processing to completed. Here it is in the PayPal sandbox... out of the business account, into the rider's. | 11.1 s |
| **N9** | Pay someone with no PayPal account yet, and PayPal emails them a sign-up link. BolPay shows that honestly, as awaiting sign-up, instead of pretending it's stuck. | 10.9 s |
| **N10** | [warmly] Voice first. Rules you can trust. A human on every payment. Real PayPal payouts. And a way in from the HR tools businesses already use. BolPay. Speak. Approve. Pay. | 14.3 s |

Narration total: 110.4 s. **Manager lines** (say them naturally, one breath each):

| Clip | Manager says | Length |
|---|---|---|
| **M1** | "Mark Anita Sharma absent today, then prepare payouts for Ravi Kumar and Mohammed Ali, then approve everything that's pending." | 8.7 s |
| **M2** | "Confirm." | 1.1 s |
| **M3** | "Yes, go ahead." | 1.5 s |
| **M4** | "Prepare payouts for everyone." (typed, not spoken; see 1:43) | 2.3 s |

## 4. Master timeline (this is the one to edit against)

Times are video time (m:ss). "Starts when" tells you the visual event that triggers the clip, so you can re-time if your voice runs long.

| Time | Visual (what is on screen) | Audio | Starts when |
|---|---|---|---|
| 0:00 – 0:14 | **Dashboard**, Demo dataset. Slow cursor drift over the stat cards. Overlay text: "Payroll today: spreadsheets + chat threads." | **N1** | First frame |
| 0:14 – 0:24 | Same dashboard. Overlay the tagline **"Speak. Approve. Pay."** and the logo. At the end, the cursor moves to the round voice button (bottom right). | **N2** | Tagline appears |
| 0:24 – 0:46 | **Zoho import.** Click **Integrations** in the sidebar (page shows **Connected**). 0:27 click **Sync now**. ~0:29 toast "Synced 20 employees from Zoho". 0:32 click **Open Zoho data** (top right): the Workers screen loads with the Zoho employees. Scroll slowly. 0:44 click **Dataset → Demo** in the sidebar (page reloads to the dashboard). | **N3** (ends ~0:40; the last 6 s are silent screen time) | The Integrations page is visible |
| 0:46 – 0:53 | Demo dashboard. Click the round **voice button**, panel opens. Move the cursor to **Tap and speak**. | **N4** | Cursor goes to the voice button |
| 0:53 – 1:03 | Click **Tap and speak**, say **M1**. The transcript appears as your chat bubble. | **M1** (live mic) | You click the mic |
| 1:03 – 1:10 | The **plan card** appears with 3 numbered steps (mark attendance, prepare payouts, approve and send). BolPay reads it aloud. At ~1:09.5 tap the mic to cut the reading. | BolPay's voice (app) | Plan card appears |
| 1:10 – 1:14 | Zoom in on the plan card (editor zoom 120 percent). | **N5** | The reading stops |
| 1:14 – 1:16 | Tap the mic, say **M2**. | **M2** (live) | You tap the mic |
| 1:16 – 1:25 | Steps 1 and 2 tick off. The **amber checkpoint card** appears: "Before I send money: 2 payments totalling ₹17,216.25 ($202.54 sent to PayPal)". BolPay reads it aloud. Hold on the amounts. | BolPay's voice (app) | Amber card appears |
| 1:25 – 1:34 | Zoom in on the amber card and the **Confirm and send** button. | **N6** | The reading ends |
| 1:35 – 1:37 | Tap the mic, say **M3**. | **M3** (live) | You tap the mic |
| 1:37 – 1:43 | All three steps show ✓. BolPay says "Done... approved 2 payouts... and sent them to PayPal." Let it play about 5 s. | BolPay's voice (app) | The ticks complete |
| 1:43 – 1:49 | Click the **speaker icon** in the panel (voice replies off). In the text box type **M4** ("Prepare payouts for everyone") and press Go; click **Confirm** on the plan card. Then click **Payout approvals** in the sidebar. | silent (typing sounds only) | The Done speech ends |
| 1:49 – 2:04 | **Payout approvals.** The **Needs review** card is at the top, listing riders with missing or conflicting records and the reason under each. Hover or expand one **Details** under *Awaiting approval* to show the breakdown (base, overtime, delivery tiers, rules version). | **N7** | Needs review card visible |
| 2:05 – 2:11 | **Transactions.** Rows for Ravi Kumar and Mohammed Ali show **Completed** (the ₹ amount and "$91.91 via PayPal" under it). A "Payment completed" toast slides in if you are recording as it lands. | **N8** (first half) | Transactions page loads |
| 2:11 – 2:16 | Switch to the **PayPal sandbox business window, Activity**: the two payouts (about US$91.91 and US$110.63 plus fees) at the top. | **N8** (second half) | You switch windows |
| 2:16 – 2:24 | Switch to the **private window, rider's account, Activity**: the received payment. Hold 3 s, then back to the app. | silent (music bed only, if you use one) | You switch windows |
| 2:24 – 2:27 | Click **Dataset → Zoho HRMS** (reload), then **Transactions** in the sidebar. | silent | You click the switch |
| 2:27 – 2:38 | **Zoho dataset, Transactions.** The row for the employee with no PayPal account shows the amber **Awaiting PayPal sign-up** badge and its explanation; point at the filter tab "Awaiting sign-up" and the **Cancel and refund** button. | **N9** | The amber row is visible |
| 2:39 – 2:53 | Cut to the **dashboard** (or an end card): logo, **Speak. Approve. Pay.**, the repo URL, "Built for the PayPal AI Hackathon". | **N10** | End card appears |
| 2:53 – 2:55 | Fade to black. | none | |

**Total about 2:55.** If your narrator is slower and the total passes 3:00, trim in this order: (1) cut **N5** and the 1:10 zoom (saves 4 s); (2) drop the 2:16 rider-account shot (8 s); (3) shorten N7 to its first sentence (7 s).

**Timing note for the payments:** a sandbox payout takes about 40 to 70 seconds to complete. Record the Transactions page and the PayPal windows (the 2:05 to 2:24 block) **after** the payments have completed, as separate clips, and cut them in. If you also want the "processing → completed" change on camera, start a screen clip right after M3 and trim it.

## 5. How to record each block

Record these as separate clips (OBS: one scene, stop/start between blocks). Save as `01-dashboard`, `02-zoho`, `03-voice`, `04-payouts`, `05-transactions`, `06-paypal`, `07-unclaimed`, `08-endcard`.

1. **01-dashboard** (15 s): Demo dashboard, slow drift. Record 25 s so you can trim.
2. **02-zoho** (25 s): Integrations → Sync now → toast → Open Zoho data → Workers → scroll → switch back to Demo. Practice the click order once.
3. **03-voice** (65 s): one unbroken take of the voice conversation from the click on the round button to the "Done" speech. System audio **on**, mic **on**. Say M1, M2, M3 live. Tap the mic to cut BolPay's plan reading at about 6 s. If a command is mis-heard, press **New conversation** and redo the take.
4. **04-payouts** (20 s): type M4, confirm, open Payout approvals, expand one rider's Details.
5. **05-transactions** (20 s): after payments completed. Show tabs, the Completed rows and the "$ via PayPal" line.
6. **06-paypal** (20 s): the two signed-in PayPal windows, 8 s each.
7. **07-unclaimed** (15 s): Zoho dataset → Transactions → the amber row.
8. **08-endcard**: a static slide (Canva, PowerPoint or Clipchamp): logo, tagline, repo URL. No third-party logos (see section 8).

Option if you do not want to speak on camera: type M1 to M3 into the box in the voice panel (the typing is visible), and lay the manager clips from `demo-assets/audio/manager/` over those moments in the edit.

## 6. Generate the narration in ElevenLabs (voice `sXcl1NoQHcU7NRh6Na5D`)

You use ElevenLabs on the website, because the API refuses library voices on the free plan.

1. elevenlabs.io → **Voices** → **Explore** (the voice library) → add voice id `sXcl1NoQHcU7NRh6Na5D` to **My Voices**. (If the site also refuses it on your plan, upgrade for one month, or pick any premade voice; the clips work the same.)
2. **Text to speech** → choose that voice → model **Eleven v4** (API id `eleven_v4`, which the API accepted in my test). If v4 is not in your dropdown, use **Eleven v3**. Keep the speed at 1.0; set **stability to "Natural"** (about 0.5) so it sounds conversational.
3. Paste each clip's text from section 3 (N1 first), generate, listen, download as `N1.mp3` and so on. One clip per generation; re-generate any that sound rushed.
4. Re-listen for the bracket words. If you hear "calmly" or "warmly" spoken aloud, delete the brackets and regenerate that clip.
5. Write each clip's length down next to its id and update the timeline (section 4) if it differs from the stand-in by more than a second or two.

**Characters used:** the narration is 1,603 characters and the manager lines 176. (I already used 1,779 of your free credits generating the stand-in and manager clips.)

**Faster, once your plan allows the voice:** `NARRATOR_VOICE_ID=sXcl1NoQHcU7NRh6Na5D node scripts/demo-narration.mjs` renders all 14 clips into `demo-assets/audio/` and prints each length. You can also run it for single clips, for example `node scripts/demo-narration.mjs N3 M1`.

**Ready-made files already on your disk:** `demo-assets/audio/manager/M1.mp3` to `M4.mp3` (premade voice Sarah, usable as is) and `demo-assets/audio/narrator-proxy/N1.mp3` to `N10.mp3` (stand-in voice, for rough-cut timing only). These are git-ignored.

## 7. Edit it together (CapCut, DaVinci Resolve or Clipchamp)

1. New 1920×1080, 30 fps project. Import the eight screen clips and the narration clips.
2. Place the screen clips and narration on the timeline following section 4. Put narration on its own audio track, **screen/system audio on another** (BolPay's replies), the microphone track on a third.
3. **Ducking:** lower the system-audio track by about 12 dB whenever a narration clip plays. During BolPay's replies and the manager's lines the narrator is silent by design, so no overlap.
4. **Zooms:** add a slow zoom (110 to 130 percent) on the plan card (1:03), the amber checkpoint card (1:16), the Needs review card (1:49) and the awaiting-sign-up row (2:27). Add a soft cursor highlight if your recorder has one.
5. **Captions:** burn in subtitles from the section 3 text (judges often watch muted). Put the manager's spoken commands on screen as captions too.
6. **Overlays (keep them to text):** a 2-second lower-third on each new screen: "Zoho People import", "One sentence, three steps", "Exact amounts before any money moves", "Live PayPal payout", "Needs Review safeguard", "Awaiting PayPal sign-up".
7. Fade in at 0:00 and out at 2:53. No music is needed; if you want a bed, use only a track from the YouTube Audio Library (no copyrighted music is allowed).
8. Export H.264 MP4, 1080p, 30 fps, **under 3:00**.

## 8. Upload and submission checklist

- Upload to YouTube as **Public**. Title: `BolPay: Speak. Approve. Pay. | Voice-first payroll with PayPal Payouts`.
- The video must show the project working: keep the real screens; don't use mockups.
- No third-party trademarks or copyrighted material: keep the PayPal sandbox shots short and functional, don't use PayPal, Zoho or ElevenLabs logos on your title or end cards, and use no copyrighted music.
- Paste the YouTube link into the Devpost form. Keep the README run steps current (judges can run it themselves).

**YouTube description (paste):**
```
BolPay is a voice-first workforce payout agent. Say what you need in one sentence, a rules engine calculates the pay, a human approves with the exact amounts on screen, and PayPal Payouts sends the money. Employees and attendance import from Zoho People, and payments to people without a PayPal account are tracked honestly as awaiting sign-up.

Built for the PayPal AI Hackathon 2026 with Next.js, PayPal Payouts, ElevenLabs (speech-to-text and text-to-speech) and Groq.
```

**Devpost project description (paste, about 230 words):**
```
BolPay turns payroll into a conversation. Managers who pay riders, packers or contractors spend hours reconciling attendance, deliveries and bonuses. With BolPay they speak one sentence, in English, Hindi or Hinglish: "Mark Anita absent, prepare payouts for Ravi and Mohammed, then approve everything that's pending."

How it works: ElevenLabs Scribe transcribes the voice, a Groq language model turns it into an ordered plan, and the server checks every step against real records. A deterministic rules engine (wage, overtime, daily delivery tiers, attendance bonus) calculates every amount: the AI never does the maths and can never approve a payment by itself. Anything that moves money pauses on an exact checkpoint (payments, rupee total, US-dollar total) and needs a second confirmation. PayPal Payouts then sends the money, with idempotent batches and webhook signature verification; statuses sync back, including payments waiting for a recipient to sign up to PayPal.

Real adoption needs a way in, so BolPay imports employees and attendance from Zoho People (OAuth), keeps pay settings under the owner's control on every re-sync, and keeps the trained demo data in a separate dataset. Roles (owner, supervisor, worker) decide who may approve, record attendance, or only see their own pay.

Built with: Next.js 16, PayPal Payouts REST API and Orders SDK, ElevenLabs (Scribe and TTS), Groq (gpt-oss), Supabase Auth, AG Grid, Zoho People API.
```

## 9. Optional extras (only for a longer cut, not the 3-minute one)

- **Hindi moment (8 s):** after the Done speech, say "रवि कुमार को आज उपस्थित मार्क करो"; BolPay shows the plan and answers in Hindi.
- **AG Grid attendance history (5 s):** Attendance page, scroll to the history grid, sort a column, filter a rider.
- **Rules by voice (10 s):** "Set the twenty delivery bonus to one hundred fifty rupees" shows the rules version go up.
- **Role view (8 s):** sign in as `supervisor@demo.bolpay.app` to show the money pages are not there.

## 10. If something goes wrong on the day

| Problem | Fix |
|---|---|
| The assistant mis-hears a command | **New conversation**, say it again slower; or type it. |
| Groq answers "busy" | Wait 30 seconds (free tier: 8,000 tokens per minute per model; it fails over to a second model automatically). |
| A payment is still processing | Keep working; record the Transactions block later. |
| Numbers differ from the table | Rules changed or the data wasn't fresh: repeat the reset in section 2. |
| You need a retake of the whole voice block | Delete `.data/db.json`, restart the server, repeat. |

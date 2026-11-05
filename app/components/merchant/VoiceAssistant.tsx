"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/app/lib/merchant/store";
import type { IntentContext, IntentPlan } from "@/app/lib/merchant/intent-types";
import { describePlan, isInformational, parseVoiceCommand } from "@/app/lib/merchant/voice-commands";
import { Button, inputClass } from "./ui";
import { useSpeaker } from "./useSpeaker";

type Phase = "idle" | "recording" | "transcribing";

async function transcribe(body: FormData): Promise<{ ok: true; text: string } | { ok: false; error: string }> {
  try {
    const res = await fetch("/api/voice-input", { method: "POST", body });
    const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (res.ok && typeof data.text === "string") return { ok: true, text: data.text };
    return { ok: false, error: `${data.error ?? "Transcription failed."} Type the command instead.` };
  } catch {
    return { ok: false, error: "Could not reach the server. Type the command instead." };
  }
}

async function fetchPlan(
  text: string,
  context?: IntentContext,
): Promise<{ plan: IntentPlan } | { error: string; unavailable: boolean }> {
  try {
    const res = await fetch("/api/intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, context }),
    });
    const data = (await res.json().catch(() => ({}))) as { plan?: IntentPlan; error?: string };
    if (res.ok && data.plan) return { plan: data.plan };
    // 4xx other than 429 means our input was rejected; anything else means the AI itself is unavailable.
    return { error: data.error ?? "The assistant is unavailable.", unavailable: !(res.status >= 400 && res.status < 500 && res.status !== 429) };
  } catch {
    return { error: "Could not reach the assistant.", unavailable: true };
  }
}

export function VoiceAssistant() {
  const router = useRouter();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [intent, setIntent] = useState<IntentPlan | null>(null);
  const [thinking, setThinking] = useState(false);
  const pendingQuestion = useRef<IntentContext | null>(null);
  const speaker = useSpeaker();
  const [message, setMessage] = useState<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);

  const stopStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stopStream, []);

  const interpret = useCallback(
    async (transcript: string) => {
      const clean = transcript.trim();
      setText(clean);
      setMessage(null);
      setIntent(null);
      if (!clean) return;
      setThinking(true);
      const result = await fetchPlan(clean, pendingQuestion.current ?? undefined);
      setThinking(false);

      let plan: IntentPlan;
      if ("plan" in result) {
        plan = result.plan;
      } else if (result.unavailable) {
        // AI unavailable: fall back to the basic English parser so the screen still works.
        plan = parseVoiceCommand(clean, store.workers, store.today);
        setMessage(`${result.error} Using the basic command parser instead.`);
      } else {
        setMessage(result.error);
        return;
      }
      // Remember a clarifying question so the next reply is understood in context.
      pendingQuestion.current = plan.kind === "clarify" ? { previousText: clean, question: plan.question } : null;
      setIntent(plan);
      // Read answers and questions aloud. Actions to confirm stay silent so a mic never hears the app.
      if (plan.kind === "answer" || plan.kind === "clarify") {
        const outcome = await speaker.speak(describePlan(plan));
        if (outcome === "blocked") setMessage("Tap the speaker button to hear this.");
      }
    },
    [store.workers, store.today, speaker],
  );

  async function startRecording() {
    speaker.stop(); // don't let the mic pick up the assistant's own voice
    setMessage(null);
    setIntent(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMessage("Recording isn't supported in this browser. Type the command instead.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setMessage("Microphone access was blocked. Allow it in your browser, or type the command.");
      return;
    }
    chunks.current = [];
    const rec = new MediaRecorder(stream.current);
    rec.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    rec.onstop = async () => {
      stopStream();
      const blob = new Blob(chunks.current, { type: rec.mimeType || "audio/webm" });
      setPhase("transcribing");
      const body = new FormData();
      body.append("audio", blob, "command.webm");
      const res = await transcribe(body);
      setPhase("idle");
      if (res.ok) void interpret(res.text);
      else setMessage(res.error);
    };
    recorder.current = rec;
    rec.start();
    setPhase("recording");
  }

  function stopRecording() {
    recorder.current?.stop();
  }

  async function confirm() {
    if (!intent || isInformational(intent)) return;
    const plan = intent;
    setIntent(null);
    switch (plan.kind) {
      case "mark":
        store.markStatus(plan.workerId, plan.date, plan.status);
        break;
      case "overtime":
        store.setAttendance(plan.workerId, plan.date, { overtimeHours: plan.hours });
        break;
      case "units":
        store.setAttendance(plan.workerId, plan.date, { units: plan.units });
        break;
      case "prepare": {
        const n = await store.submitPeriodForApproval();
        setMessage(n > 0 ? `${n} payout${n === 1 ? "" : "s"} are ready for your approval.` : "Nothing new to submit for this period.");
        router.push("/payouts");
        setText("");
        return;
      }
      case "approve":
      case "reject": {
        const ids = store.payouts
          .filter((p) => p.status === "pending" && (!plan.workerId || p.workerId === plan.workerId))
          .map((p) => p.id);
        if (!ids.length) {
          setMessage("There are no pending payouts to act on.");
          return;
        }
        await (plan.kind === "approve" ? store.approvePayouts : store.rejectPayouts)(ids);
        router.push("/transactions");
        break;
      }
      case "navigate":
        router.push(plan.to);
        break;
    }
    setMessage("Done.");
    setText("");
  }

  const busy = phase !== "idle" || thinking;

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div role="dialog" aria-label="Voice commands" className="w-[min(92vw,22rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Voice commands</h2>
            <div className="flex items-center gap-3">
              <button
                onClick={() => speaker.setEnabled(!speaker.enabled)}
                aria-pressed={speaker.enabled}
                aria-label={speaker.enabled ? "Turn voice replies off" : "Turn voice replies on"}
                title={speaker.enabled ? "Voice replies on" : "Voice replies off"}
                className={speaker.enabled ? "text-teal-700" : "text-slate-400"}
              >
                <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M11 5L6 9H3v6h3l5 4V5z" />
                  {speaker.enabled ? <path d="M15.5 8.5a5 5 0 010 7M18.5 5.5a9 9 0 010 13" /> : <path d="M16 9l5 6M21 9l-5 6" />}
                </svg>
              </button>
              <button onClick={() => { speaker.stop(); setOpen(false); }} className="text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
            </div>
          </div>

          <button
            onClick={phase === "recording" ? stopRecording : startRecording}
            disabled={phase === "transcribing"}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors disabled:bg-slate-300 ${
              phase === "recording" ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700"
            }`}
          >
            <span className={`size-2.5 rounded-full bg-white ${phase === "recording" ? "animate-pulse" : ""}`} />
            {phase === "recording" ? "Listening… tap to stop" : phase === "transcribing" ? "Transcribing…" : "Tap and speak"}
          </button>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void interpret(text);
            }}
          >
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="…or type a command"
              aria-label="Command text"
              className={inputClass}
              disabled={busy}
            />
            <Button type="submit" disabled={busy || !text.trim()}>{thinking ? "…" : "Go"}</Button>
          </form>

          {intent && (
            <div className={`mt-3 rounded-lg p-3 text-sm ${isInformational(intent) ? (intent.kind === "answer" ? "bg-slate-100 text-slate-800" : "bg-amber-50 text-amber-800") : "bg-teal-50 text-teal-900"}`}>
              <p>{describePlan(intent)}</p>
              {intent.kind === "prepare" && intent.warnings.map((w) => <p key={w} className="mt-1 text-xs text-amber-700">{w}</p>)}
              {(intent.kind === "answer" || intent.kind === "clarify") && (
                <button
                  onClick={() => (speaker.speaking ? speaker.stop() : void speaker.speak(describePlan(intent), { force: true }))}
                  className="mt-2 text-xs font-medium underline"
                >
                  {speaker.speaking ? "Stop" : "🔊 Read aloud"}
                </button>
              )}
              {!isInformational(intent) && (
                <div className="mt-2 flex gap-2">
                  <Button variant="primary" onClick={() => void confirm()}>Confirm</Button>
                  <Button variant="ghost" onClick={() => setIntent(null)}>Cancel</Button>
                </div>
              )}
            </div>
          )}
          {message && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}

          <p className="mt-3 text-xs text-slate-400">
            Try: “mark Ravi present”, “Anita worked 2 hours overtime”, “prepare payouts”, “approve all”, “how many payments failed?”. Hindi and other languages work too.
          </p>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle voice commands"
        aria-expanded={open}
        className="flex size-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition-colors hover:bg-teal-700"
      >
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3" />
        </svg>
      </button>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/app/lib/merchant/store";
import { describeIntent, parseVoiceCommand, type VoiceIntent } from "@/app/lib/merchant/voice-commands";
import { Button, inputClass } from "./ui";

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

export function VoiceAssistant() {
  const router = useRouter();
  const store = useStore();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [intent, setIntent] = useState<VoiceIntent | null>(null);
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
    (transcript: string) => {
      setText(transcript);
      setIntent(parseVoiceCommand(transcript, store.workers));
    },
    [store.workers],
  );

  async function startRecording() {
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
      if (res.ok) interpret(res.text);
      else setMessage(res.error);
    };
    recorder.current = rec;
    rec.start();
    setPhase("recording");
  }

  function stopRecording() {
    recorder.current?.stop();
  }

  function confirm() {
    if (!intent || intent.kind === "unknown") return;
    const today = store.today;
    const pending = store.payouts.filter((p) => p.status === "pending");
    switch (intent.kind) {
      case "mark":
        store.markStatus(intent.worker.id, today, intent.status);
        break;
      case "overtime":
        store.setAttendance(intent.worker.id, today, { overtimeHours: intent.hours });
        break;
      case "units":
        store.setAttendance(intent.worker.id, today, { units: intent.units });
        break;
      case "approve":
      case "reject": {
        const ids = pending.filter((p) => !intent.worker || p.workerId === intent.worker.id).map((p) => p.id);
        if (!ids.length) {
          setMessage("There are no pending payouts to act on.");
          setIntent(null);
          return;
        }
        (intent.kind === "approve" ? store.approvePayouts : store.rejectPayouts)(ids);
        router.push("/transactions");
        break;
      }
      case "navigate":
        router.push(intent.to);
        break;
    }
    setMessage("Done.");
    setIntent(null);
    setText("");
  }

  const busy = phase !== "idle";

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div role="dialog" aria-label="Voice commands" className="w-[min(92vw,22rem)] rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Voice commands</h2>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
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
              setMessage(null);
              interpret(text);
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
            <Button type="submit" disabled={busy || !text.trim()}>Go</Button>
          </form>

          {intent && (
            <div className={`mt-3 rounded-lg p-3 text-sm ${intent.kind === "unknown" ? "bg-amber-50 text-amber-800" : "bg-teal-50 text-teal-900"}`}>
              <p>{describeIntent(intent, store.today)}</p>
              {intent.kind !== "unknown" && (
                <div className="mt-2 flex gap-2">
                  <Button variant="primary" onClick={confirm}>Confirm</Button>
                  <Button variant="ghost" onClick={() => setIntent(null)}>Cancel</Button>
                </div>
              )}
            </div>
          )}
          {message && !intent && <p role="status" className="mt-3 text-sm text-slate-600">{message}</p>}

          <p className="mt-3 text-xs text-slate-400">
            Try: “mark Ravi present”, “Anita worked 2 hours overtime”, “approve all payouts”, “open attendance”.
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

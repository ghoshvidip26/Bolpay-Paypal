"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, type Snapshot } from "@/app/lib/merchant/store";
import { Button, inputClass } from "./ui";
import { useSpeaker } from "./useSpeaker";

type Phase = "idle" | "recording" | "transcribing";
type StepStatus = "pending" | "done" | "skipped" | "failed" | "not_run";

interface StepView {
  action: string;
  summary: string;
  risk: "read" | "write" | "money";
  status: StepStatus;
  message?: string;
}

interface TurnView {
  sessionId: string;
  state: "idle" | "clarifying" | "confirming";
  outcome: string;
  speech: string;
  lines: string[];
  steps: StepView[];
  awaiting: "reply" | "confirm" | null;
  navigate?: string;
  checkpoint?: boolean;
}

interface Message {
  role: "user" | "assistant";
  text: string;
}

const STORAGE_KEY = "bolpay.voice.session";
const MAX_MESSAGES = 30;

const SUGGESTIONS = [
  "Mark everyone present today",
  "Calculate incentives for Bengaluru riders with at least twenty deliveries today",
  "Who is missing attendance today?",
  "How many payments failed?",
];

const STATUS_ICON: Record<StepStatus, string> = { pending: "○", done: "✓", skipped: "–", failed: "✕", not_run: "·" };
const STATUS_TONE: Record<StepStatus, string> = { pending: "text-slate-400", done: "text-emerald-600", skipped: "text-slate-400", failed: "text-rose-600", not_run: "text-slate-300" };

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

function loadSaved(): { sessionId: string | null; messages: Message[]; view: TurnView | null } {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return { sessionId: null, messages: [], view: null };
}

export function VoiceAssistant() {
  const router = useRouter();
  const store = useStore();
  const speaker = useSpeaker();
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [text, setText] = useState("");
  const [thinking, setThinking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [view, setView] = useState<TurnView | null>(null);
  // Saving to sessionStorage waits until the saved session has been read back (React runs effects twice in dev).
  const hydrated = useRef(false);
  const sessionId = useRef<string | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const stream = useRef<MediaStream | null>(null);
  const scroller = useRef<HTMLDivElement>(null);

  const stopStream = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };
  useEffect(() => stopStream, []);

  // Restore the conversation after a reload: the pending question or plan lives on the server.
  useEffect(() => {
    const saved = loadSaved();
    if (!saved.sessionId) {
      hydrated.current = true;
      return;
    }
    let cancelled = false;
    void fetch(`/api/voice/turn?sessionId=${encodeURIComponent(saved.sessionId)}`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          sessionId.current = saved.sessionId;
          setMessages(saved.messages);
          setView((await res.json()) as TurnView);
        } else sessionStorage.removeItem(STORAGE_KEY);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) hydrated.current = true;
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated.current) return;
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ sessionId: sessionId.current, messages, view }));
    } catch {
      /* ignore */
    }
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight });
  }, [messages, view]);

  const send = useCallback(
    async (input: { text?: string; action?: "confirm" | "cancel" }, shown?: string) => {
      const label = shown ?? input.text ?? (input.action === "confirm" ? "Confirm" : "Cancel");
      setNotice(null);
      setText("");
      setMessages((m) => [...m, { role: "user" as const, text: label }].slice(-MAX_MESSAGES));
      setThinking(true);
      try {
        await store.flush(); // queued attendance edits must reach the server before a flow runs
        const res = await fetch("/api/voice/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: sessionId.current, ...input }),
        });
        const data = (await res.json().catch(() => ({}))) as TurnView & { snapshot?: Snapshot; error?: string };
        if (!res.ok || !data.sessionId) {
          setNotice(data.error ?? "The assistant is unavailable. Your conversation is kept; try again.");
          return;
        }
        sessionId.current = data.sessionId;
        if (data.snapshot) store.applySnapshot(data.snapshot);
        setView(data);
        setMessages((m) => [...m, { role: "assistant" as const, text: data.speech }].slice(-MAX_MESSAGES));
        if (data.navigate) router.push(data.navigate);
        setThinking(false); // controls are usable while the reply is being fetched and spoken
        const outcome = await speaker.speak(data.speech);
        if (outcome === "blocked") setNotice("Tap the speaker button to hear replies.");
      } catch {
        setNotice("Could not reach the assistant. Your conversation is kept; try again.");
      } finally {
        setThinking(false);
      }
    },
    [store, router, speaker],
  );

  async function startRecording() {
    speaker.stop(); // don't let the mic pick up the assistant's own voice
    setNotice(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setNotice("Recording isn't supported in this browser. Type the command instead.");
      return;
    }
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setNotice("Microphone access was blocked. Allow it in your browser, or type the command.");
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
      if (!res.ok) setNotice(res.error);
      else if (!res.text.trim()) setNotice("I didn't catch that. Try again.");
      else void send({ text: res.text.trim() });
    };
    recorder.current = rec;
    rec.start();
    setPhase("recording");
  }

  function stopRecording() {
    recorder.current?.stop();
  }

  async function newConversation() {
    speaker.stop();
    const id = sessionId.current;
    sessionId.current = null;
    setMessages([]);
    setView(null);
    setNotice(null);
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      if (id) await fetch("/api/voice/turn", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: id, reset: true }) });
    } catch {
      /* the server drops idle sessions on its own */
    }
  }

  const busy = phase === "transcribing" || thinking;
  const awaiting = view?.awaiting ?? null;
  const micLabel =
    phase === "recording" ? "Listening… tap to stop" : phase === "transcribing" ? "Transcribing…" : awaiting === "reply" ? "Tap and answer" : awaiting === "confirm" ? "Tap and say confirm or cancel" : "Tap and speak";

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div role="dialog" aria-label="Voice commands" className="flex max-h-[min(80vh,40rem)] w-[min(94vw,24rem)] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-xl">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Voice commands</h2>
            <div className="flex items-center gap-3">
              {messages.length > 0 && (
                <button onClick={() => void newConversation()} className="text-xs text-slate-500 underline hover:text-slate-700">
                  New conversation
                </button>
              )}
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
              <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-600" aria-label="Close">✕</button>
            </div>
          </div>

          <div ref={scroller} className="mb-3 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1" aria-live="polite">
            {messages.length === 0 && (
              <div className="space-y-2 text-xs text-slate-500">
                <p>Say or type what you need. You can chain steps in one sentence, and answer follow-up questions by voice.</p>
                <div className="flex flex-wrap gap-1.5">
                  {SUGGESTIONS.map((s) => (
                    <button key={s} disabled={busy} onClick={() => void send({ text: s })} className="rounded-full border border-slate-200 px-2.5 py-1 text-left text-slate-600 hover:bg-slate-50 disabled:opacity-50">
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[88%] rounded-2xl px-3 py-1.5 text-sm ${m.role === "user" ? "bg-teal-600 text-white" : "bg-slate-100 text-slate-800"}`}>{m.text}</p>
              </div>
            ))}
            {thinking && <p className="text-xs text-slate-400">Thinking…</p>}
          </div>

          {view && view.steps.length > 0 && (
            <ol className={`mb-3 space-y-1 rounded-lg border p-2 text-xs ${view.checkpoint ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50"}`} aria-label="Plan">
              {view.steps.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className={`mt-px font-mono ${STATUS_TONE[s.status]}`} aria-label={s.status}>{STATUS_ICON[s.status]}</span>
                  <span className={s.risk === "money" ? "font-medium text-amber-800" : "text-slate-700"}>
                    {s.summary}
                    {s.message && <span className="block text-slate-500">{s.message}</span>}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {awaiting === "confirm" && (
            <div className="mb-3 flex items-center gap-2">
              <Button variant="primary" disabled={busy} onClick={() => void send({ action: "confirm" })}>
                {view?.checkpoint ? "Confirm and send" : "Confirm"}
              </Button>
              <Button variant="ghost" disabled={busy} onClick={() => void send({ action: "cancel" })}>Cancel</Button>
              <span className="text-xs text-slate-400">or say “confirm” / “cancel”</span>
            </div>
          )}
          {awaiting === "reply" && <p className="mb-2 text-xs text-teal-700">Waiting for your answer. Tap the mic or type it.</p>}

          <button
            onClick={phase === "recording" ? stopRecording : startRecording}
            disabled={phase === "transcribing" || thinking}
            className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white transition-colors disabled:bg-slate-300 ${phase === "recording" ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-600 hover:bg-teal-700"}`}
          >
            <span className={`size-2.5 rounded-full bg-white ${phase === "recording" ? "animate-pulse" : ""}`} />
            {micLabel}
          </button>

          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (text.trim()) void send({ text: text.trim() });
            }}
          >
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={awaiting === "reply" ? "…or type your answer" : "…or type a command"} aria-label="Command text" className={inputClass} disabled={busy} />
            <Button type="submit" disabled={busy || !text.trim()}>{thinking ? "…" : "Go"}</Button>
          </form>
          {notice && <p role="status" className="mt-2 text-xs text-amber-700">{notice}</p>}
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Toggle voice commands"
        aria-expanded={open}
        className="relative flex size-14 items-center justify-center rounded-full bg-teal-600 text-white shadow-lg transition-colors hover:bg-teal-700"
      >
        {!open && awaiting && <span className="absolute -right-0.5 -top-0.5 size-3.5 animate-pulse rounded-full bg-amber-400 ring-2 ring-white" aria-label="Waiting for your reply" />}
        <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5 11a7 7 0 0014 0M12 18v3" />
        </svg>
      </button>
    </div>
  );
}

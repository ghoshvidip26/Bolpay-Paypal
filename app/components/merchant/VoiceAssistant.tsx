"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore, type Snapshot } from "@/app/lib/merchant/store";
import { playSound } from "@/app/lib/client/sounds";
import { IconClose, IconMic, IconSpeaker, IconSpeakerOff } from "../icons";
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

const STATUS_LABEL: Record<StepStatus, string> = { pending: "Waiting", done: "Done", skipped: "Skipped", failed: "Failed", not_run: "Not run" };
const STATUS_TONE: Record<StepStatus, string> = { pending: "text-slate-500", done: "text-emerald-700", skipped: "text-slate-400", failed: "text-rose-700", not_run: "text-slate-400" };

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
          playSound("error");
          setNotice(data.error ?? "The assistant is unavailable. Your conversation is kept; try again.");
          return;
        }
        sessionId.current = data.sessionId;
        if (data.snapshot) store.applySnapshot(data.snapshot);
        setView(data);
        setMessages((m) => [...m, { role: "assistant" as const, text: data.speech }].slice(-MAX_MESSAGES));
        // A money checkpoint always gets the attention tone; otherwise a blip only when replies aren't spoken.
        if (data.awaiting === "confirm" && data.checkpoint) playSound("attention");
        else if (data.steps?.some((s) => s.status === "failed")) playSound("error");
        else if (!speaker.enabled) playSound("notify");
        if (data.navigate) router.push(data.navigate);
        setThinking(false); // controls are usable while the reply is being fetched and spoken
        const outcome = await speaker.speak(data.speech);
        if (outcome === "blocked") setNotice("Tap the speaker button to hear replies.");
      } catch {
        playSound("error");
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
      if (!res.ok) {
        playSound("error");
        setNotice(res.error);
      } else if (!res.text.trim()) setNotice("I didn't catch that. Try again.");
      else void send({ text: res.text.trim() });
    };
    recorder.current = rec;
    playSound("micOn");
    rec.start();
    setPhase("recording");
  }

  function stopRecording() {
    recorder.current?.stop();
    playSound("micOff");
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
    phase === "recording" ? "Listening. Tap to stop" : phase === "transcribing" ? "Transcribing…" : awaiting === "reply" ? "Tap and answer" : awaiting === "confirm" ? "Tap and say confirm or cancel" : "Tap and speak";

  return (
    <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-3">
      {open && (
        <div
          role="dialog"
          aria-label="Voice assistant"
          className="flex max-h-[min(80vh,40rem)] w-[min(calc(100vw-2rem),23rem)] flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-[0_12px_32px_-12px_rgba(15,23,42,0.25)]"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3.5 py-2.5">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-slate-900">Voice assistant</h2>
              <p className="text-xs text-slate-500">Any language. Money steps always ask first.</p>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button onClick={() => void newConversation()} className="rounded px-1.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-900">
                  New
                </button>
              )}
              <button
                onClick={() => speaker.setEnabled(!speaker.enabled)}
                aria-pressed={speaker.enabled}
                aria-label={speaker.enabled ? "Turn voice replies off" : "Turn voice replies on"}
                title={speaker.enabled ? "Voice replies on" : "Voice replies off"}
                className={`rounded p-1 hover:bg-slate-100 ${speaker.enabled ? "text-teal-700" : "text-slate-400"}`}
              >
                {speaker.enabled ? <IconSpeaker className="size-4" /> : <IconSpeakerOff className="size-4" />}
              </button>
              <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close assistant">
                <IconClose className="size-4" />
              </button>
            </div>
          </div>

          <div ref={scroller} className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3.5 py-3" aria-live="polite">
            {messages.length === 0 && (
              <div>
                <p className="text-xs text-slate-500">Say or type what you need. You can chain steps in one sentence and answer follow-up questions by voice.</p>
                <p className="mb-1 mt-3 text-xs font-medium text-slate-500">Try</p>
                <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
                  {SUGGESTIONS.map((s) => (
                    <li key={s}>
                      <button disabled={busy} onClick={() => void send({ text: s })} className="w-full px-2.5 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50">
                        {s}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <p className={`max-w-[88%] rounded-lg px-2.5 py-1.5 text-sm ${m.role === "user" ? "bg-teal-700 text-white" : "bg-slate-100 text-slate-800"}`}>{m.text}</p>
              </div>
            ))}
            {thinking && (
              <p className="flex items-center gap-1.5 text-xs text-slate-500" role="status">
                <span className="size-1.5 animate-pulse rounded-full bg-slate-400" />
                Working on it…
              </p>
            )}
          </div>

          <div className="border-t border-slate-200 px-3.5 py-3">
            {view && view.steps.length > 0 && (
              <div className={`mb-3 rounded-md border ${view.checkpoint ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-slate-50/70"}`}>
                <p className={`border-b px-2.5 py-1.5 text-xs font-medium ${view.checkpoint ? "border-amber-200 text-amber-900" : "border-slate-200 text-slate-600"}`}>
                  {view.checkpoint ? "Payment needs your confirmation" : "Plan"}
                </p>
                <ol className="space-y-1.5 px-2.5 py-2 text-xs" aria-label="Plan steps">
                  {view.steps.map((s, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-3 shrink-0 text-right tabular-nums text-slate-400">{i + 1}</span>
                      <span className={`min-w-0 flex-1 ${s.risk === "money" ? "font-medium text-amber-900" : "text-slate-700"}`}>
                        {s.summary}
                        {s.message && <span className="block font-normal text-slate-500">{s.message}</span>}
                      </span>
                      <span className={`shrink-0 font-medium ${STATUS_TONE[s.status]}`}>{STATUS_LABEL[s.status]}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {awaiting === "confirm" && (
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <Button variant="primary" size="sm" disabled={busy} onClick={() => void send({ action: "confirm" })}>
                  {view?.checkpoint ? "Confirm and send" : "Confirm"}
                </Button>
                <Button variant="ghost" size="sm" disabled={busy} onClick={() => void send({ action: "cancel" })}>Cancel</Button>
                <span className="text-xs text-slate-500">or say “confirm” or “cancel”</span>
              </div>
            )}
            {awaiting === "reply" && <p className="mb-2 text-xs text-teal-800">Waiting for your answer. Tap the mic or type it.</p>}

            <button
              data-sound="off"
              onClick={phase === "recording" ? stopRecording : startRecording}
              disabled={phase === "transcribing" || thinking}
              className={`flex h-9 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-medium text-white transition-colors disabled:bg-slate-200 disabled:text-slate-400 ${phase === "recording" ? "bg-rose-600 hover:bg-rose-700" : "bg-teal-700 hover:bg-teal-800"}`}
            >
              {phase === "recording" ? <span className="size-2 animate-pulse rounded-full bg-white" /> : <IconMic className="size-4" />}
              {micLabel}
            </button>

            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (text.trim()) void send({ text: text.trim() });
              }}
            >
              <input value={text} onChange={(e) => setText(e.target.value)} placeholder={awaiting === "reply" ? "Or type your answer" : "Or type a command"} aria-label="Command text" className={inputClass} disabled={busy} />
              <Button type="submit" disabled={busy || !text.trim()}>Send</Button>
            </form>
            {notice && <p role="status" className="mt-2 text-xs text-amber-800">{notice}</p>}
          </div>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close voice assistant" : "Open voice assistant"}
        aria-expanded={open}
        className="relative flex size-12 items-center justify-center rounded-full bg-teal-700 text-white shadow-[0_6px_16px_-6px_rgba(15,23,42,0.45)] transition-colors hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-700"
      >
        {!open && awaiting && <span className="absolute -right-0.5 -top-0.5 size-3 animate-pulse rounded-full bg-amber-400 ring-2 ring-white" aria-label="Waiting for your reply" />}
        {open ? <IconClose className="size-5" /> : <IconMic className="size-5" />}
      </button>
    </div>
  );
}

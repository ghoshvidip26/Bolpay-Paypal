"use client";

import Link from "next/link";
import { useId, useSyncExternalStore, type ReactNode } from "react";
import { usePreferences } from "@/app/lib/client/preferences";
import { playSound, type SoundName } from "@/app/lib/client/sounds";
import { signOut } from "@/app/login/actions";
import { useSpeaker } from "../useSpeaker";
import { personName, useViewer } from "../viewer";
import { Button, Card, linkClass, PageHeader, Switch } from "../ui";

type SectionId = "general" | "notifications" | "voice";
const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "general", label: "General" },
  { id: "notifications", label: "Notifications & sounds" },
  { id: "voice", label: "Voice assistant" },
];

const SAMPLES: { sound: SoundName; label: string; when: string }[] = [
  { sound: "tap", label: "Click", when: "Pressing a button, link or tab" },
  { sound: "toggleOn", label: "Switch", when: "Turning a setting on or off" },
  { sound: "success", label: "Saved", when: "A change is saved, or payouts are approved" },
  { sound: "payment", label: "Payment completed", when: "PayPal confirms a worker was paid" },
  { sound: "attention", label: "Needs you", when: "A payout is waiting for your confirmation" },
  { sound: "notify", label: "Update", when: "An assistant reply or other update arrives" },
  { sound: "error", label: "Problem", when: "A save, transfer or request fails" },
];

function Row({ title, description, children }: { title: string; description?: string; children: (ids: { label: string; desc: string }) => ReactNode }) {
  const id = useId();
  const ids = { label: `${id}-l`, desc: `${id}-d` };
  return (
    <div className="flex items-start justify-between gap-6 px-4 py-3">
      <div className="min-w-0">
        <p id={ids.label} className="text-sm font-medium text-slate-900">{title}</p>
        {description && <p id={ids.desc} className="mt-0.5 text-xs text-slate-500">{description}</p>}
      </div>
      <div className="shrink-0 pt-0.5">{children(ids)}</div>
    </div>
  );
}

// The open section lives in the URL hash, so /settings#notifications links straight to it.
const subscribeHash = (cb: () => void) => {
  window.addEventListener("hashchange", cb);
  return () => window.removeEventListener("hashchange", cb);
};

export function SettingsView() {
  const hash = useSyncExternalStore(subscribeHash, () => window.location.hash.slice(1), () => "");
  const section: SectionId = SECTIONS.some((s) => s.id === hash) ? (hash as SectionId) : "general";

  const go = (id: SectionId) => {
    // replaceState keeps Back pointing at the previous page; it doesn't fire hashchange, so announce it.
    window.history.replaceState(null, "", id === "general" ? window.location.pathname : `#${id}`);
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  return (
    <>
      <PageHeader title="Settings" />
      <div className="md:grid md:grid-cols-[11rem_minmax(0,1fr)] md:gap-8">
        <nav aria-label="Settings sections" className="mb-4 flex gap-1 overflow-x-auto md:mb-0 md:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              aria-current={section === s.id ? "page" : undefined}
              className={`shrink-0 whitespace-nowrap rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
                section === s.id ? "bg-white font-medium text-slate-900 ring-1 ring-slate-200" : "text-slate-600 hover:bg-white/70 hover:text-slate-900"
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>
        <div className="min-w-0 max-w-2xl space-y-5">
          {section === "general" && <General onOpen={go} />}
          {section === "notifications" && <Notifications />}
          {section === "voice" && <Voice />}
        </div>
      </div>
    </>
  );
}

function General({ onOpen }: { onOpen: (id: SectionId) => void }) {
  const viewer = useViewer();
  const [prefs] = usePreferences();
  const speaker = useSpeaker();
  const soundSummary = !prefs.sounds ? "Sounds off" : prefs.clickSounds ? "Sounds and clicks on" : "Sounds on, clicks off";

  return (
    <>
      <Card title="Account" flush>
        <dl className="divide-y divide-slate-100">
          {[
            ["Name", personName(viewer.displayName)],
            ["Role", viewer.role === "owner" ? "Owner" : "Supervisor"],
            ["Business", viewer.businessName],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <dt className="text-sm text-slate-500">{k}</dt>
              <dd className="truncate text-sm font-medium text-slate-900">{v}</dd>
            </div>
          ))}
        </dl>
        <div className="border-t border-slate-200 px-4 py-3">
          <form action={signOut}>
            <Button type="submit" size="sm">Sign out</Button>
          </form>
        </div>
      </Card>

      <Card title="Preferences" flush>
        <div className="divide-y divide-slate-100">
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">Notifications & sounds</p>
              <p className="mt-0.5 text-xs text-slate-500">{soundSummary} · Payment updates {prefs.paymentAlerts ? "on" : "off"}</p>
            </div>
            <Button size="sm" onClick={() => onOpen("notifications")}>Manage</Button>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3">
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-900">Voice assistant</p>
              <p className="mt-0.5 text-xs text-slate-500">{speaker.enabled ? "Replies are read aloud" : "Replies are shown as text only"}</p>
            </div>
            <Button size="sm" onClick={() => onOpen("voice")}>Manage</Button>
          </div>
        </div>
      </Card>

      <Card title="Legal" flush>
        <ul className="divide-y divide-slate-100 text-sm">
          <li className="px-4 py-2.5"><Link href="/terms" className={linkClass}>Terms of Service</Link></li>
          <li className="px-4 py-2.5"><Link href="/privacy" className={linkClass}>Privacy Policy</Link></li>
        </ul>
      </Card>
    </>
  );
}

function Notifications() {
  const [prefs, update] = usePreferences();
  const volumePct = Math.round(prefs.volume * 100);

  return (
    <>
      <Card title="Notifications" flush>
        <Row title="Payment updates" description="A notice when a PayPal payment completes or fails. Errors from your own actions always show.">
          {(ids) => <Switch checked={prefs.paymentAlerts} labelledBy={ids.label} describedBy={ids.desc} onChange={(on) => update({ paymentAlerts: on })} />}
        </Row>
      </Card>

      <Card title="Sounds" flush>
        <div className="divide-y divide-slate-100">
          <Row title="Sound effects" description="Turns every sound on or off.">
            {(ids) => (
              <Switch checked={prefs.sounds} labelledBy={ids.label} describedBy={ids.desc} onChange={(on) => {
                update({ sounds: on });
                if (on) playSound("toggleOn", { force: true }); // the click listener stays quiet while sounds are off
              }} />
            )}
          </Row>
          <Row title="Click sounds" description="A quiet click when you press buttons, switches and tabs.">
            {(ids) => (
              <Switch checked={prefs.clickSounds} disabled={!prefs.sounds} labelledBy={ids.label} describedBy={ids.desc} onChange={(on) => {
                update({ clickSounds: on });
                if (on) playSound("toggleOn", { force: true });
              }} />
            )}
          </Row>
          <div className="flex items-center justify-between gap-6 px-4 py-3">
            <label htmlFor="volume" className={`text-sm font-medium ${prefs.sounds ? "text-slate-900" : "text-slate-400"}`}>Volume</label>
            <div className="flex items-center gap-3">
              <input
                id="volume"
                type="range"
                min={5}
                max={100}
                step={5}
                value={volumePct}
                disabled={!prefs.sounds}
                onChange={(e) => update({ volume: Number(e.target.value) / 100 })}
                onPointerUp={() => playSound("notify")}
                onKeyUp={() => playSound("notify")}
                className="w-36 accent-teal-700 disabled:opacity-40 sm:w-44"
              />
              <span className="w-9 text-right text-xs text-slate-500 tabular-nums">{volumePct}%</span>
            </div>
          </div>
          <details className="group">
            <summary className="flex list-none items-center justify-between px-4 py-3 text-sm font-medium text-slate-900 hover:bg-slate-50 [&::-webkit-details-marker]:hidden">
              Preview sounds
              <span className="text-xs font-normal text-slate-500 group-open:hidden">Show</span>
              <span className="hidden text-xs font-normal text-slate-500 group-open:inline">Hide</span>
            </summary>
            <ul className="divide-y divide-slate-100 border-t border-slate-100" data-sound="off">
              {SAMPLES.map((s) => (
                <li key={s.sound} className="flex items-center justify-between gap-4 px-4 py-2">
                  <div className="min-w-0">
                    <p className="text-sm text-slate-800">{s.label}</p>
                    <p className="text-xs text-slate-500">{s.when}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => playSound(s.sound, { force: true })} aria-label={`Play the ${s.label} sound`}>Play</Button>
                </li>
              ))}
            </ul>
          </details>
        </div>
      </Card>
    </>
  );
}

function Voice() {
  const speaker = useSpeaker();
  return (
    <Card title="Voice assistant" flush>
      <Row title="Read replies aloud" description="The assistant speaks its replies. They always appear as text too.">
        {(ids) => <Switch checked={speaker.enabled} labelledBy={ids.label} describedBy={ids.desc} onChange={speaker.setEnabled} />}
      </Row>
      <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
        Payouts requested by voice always wait for a separate confirmation that states the exact amount.
      </p>
    </Card>
  );
}

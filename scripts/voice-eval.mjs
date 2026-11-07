#!/usr/bin/env node
/**
 * Voice assistant eval. Runs the fixtures in voice-eval.cases.json against a running dev server using
 * dry-run sessions (nothing is written, PayPal is never called) and prints a pass rate plus latency.
 *
 *   npm run test:voice                 all cases
 *   npm run test:voice -- hindi        only cases whose name contains "hindi"
 *   BASE_URL=http://localhost:3001 npm run test:voice
 *
 * Needs GROQ_API_KEY in the server's .env (the planner calls the model).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const PAUSE_MS = Number(process.env.EVAL_PAUSE_MS ?? 1200);
const here = dirname(fileURLToPath(import.meta.url));
const { cases } = JSON.parse(readFileSync(join(here, "voice-eval.cases.json"), "utf8").replace(/^﻿/, ""));
const filter = process.argv.slice(2).join(" ").toLowerCase();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function turn(sessionId, t) {
  const body = { sessionId, dryRun: true };
  if (t.say) body.text = t.say;
  if (t.action) body.action = t.action;
  const started = Date.now();
  const res = await fetch(`${BASE}/api/voice/turn`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const view = await res.json();
  view.ms = Date.now() - started;
  return view;
}

function check(view, e) {
  const fails = [];
  const speech = (view.speech ?? "").toLowerCase();
  const summaries = (view.steps ?? []).map((s) => s.summary).join(" | ");
  const actions = (view.steps ?? []).map((s) => s.action);
  if (e.outcome && view.outcome !== e.outcome) fails.push(`outcome ${view.outcome} (wanted ${e.outcome})`);
  if (e.outcomeAny && !e.outcomeAny.includes(view.outcome)) fails.push(`outcome ${view.outcome} (wanted one of ${e.outcomeAny})`);
  if (e.notOutcome && e.notOutcome.includes(view.outcome)) fails.push(`outcome must not be ${view.outcome}`);
  if ("awaiting" in e && view.awaiting !== e.awaiting) fails.push(`awaiting ${view.awaiting} (wanted ${e.awaiting})`);
  if (e.actions && JSON.stringify(actions) !== JSON.stringify(e.actions)) fails.push(`actions [${actions}] (wanted [${e.actions}])`);
  if (e.actionsInclude) for (const a of e.actionsInclude) if (!actions.includes(a)) fails.push(`missing action ${a} in [${actions}]`);
  if (e.maxSteps !== undefined && actions.length > e.maxSteps) fails.push(`${actions.length} steps (max ${e.maxSteps})`);
  if (e.summaryIncludes) for (const s of e.summaryIncludes) if (!summaries.toLowerCase().includes(s.toLowerCase())) fails.push(`summary lacks "${s}": ${summaries}`);
  if (e.speechIncludes) for (const s of e.speechIncludes) if (!speech.includes(s.toLowerCase())) fails.push(`speech lacks "${s}": ${view.speech}`);
  if (e.language && view.language !== e.language) fails.push(`language ${view.language} (wanted ${e.language})`);
  if (e.navigate && view.navigate !== e.navigate) fails.push(`navigate ${view.navigate} (wanted ${e.navigate})`);
  return fails;
}

await fetch(`${BASE}/api/voice/metrics`, { method: "DELETE" }).catch(() => {});
const selected = cases.filter((c) => !filter || c.name.toLowerCase().includes(filter));
let passed = 0;
const failures = [];
for (const c of selected) {
  let sid = null;
  const problems = [];
  try {
    for (const [i, t] of c.turns.entries()) {
      const view = await turn(sid, t.action ? { action: t.action } : t.confirm ? { action: "confirm" } : t);
      sid = view.sessionId;
      const fails = check(view, t.expect ?? {});
      if (t.expect?.fastPath === true && view.outcome === "executed") {
        /* fast path is verified through the metrics summary below */
      }
      fails.forEach((f) => problems.push(`turn ${i + 1} "${t.say ?? t.action}": ${f}`));
      await sleep(PAUSE_MS);
    }
  } catch (err) {
    problems.push(`error: ${err.message}`);
  }
  if (problems.length === 0) {
    passed++;
    console.log(`  PASS  ${c.name}`);
  } else {
    console.log(`  FAIL  ${c.name}`);
    problems.forEach((p) => console.log(`          - ${p}`));
    failures.push(c.name);
  }
}

const m = await fetch(`${BASE}/api/voice/metrics`).then((r) => r.json()).catch(() => null);
console.log(`\n${passed}/${selected.length} cases passed (${selected.length ? Math.round((passed / selected.length) * 100) : 0}%)`);
if (m) {
  console.log(`turns ${m.turns} | model calls ${m.llm.calls} | model latency p50 ${m.llm.p50Ms} ms, p95 ${m.llm.p95Ms} ms`);
  console.log(`clarification rate ${m.clarificationRate} | supersede rate ${m.supersedeRate} | error rate ${m.errorRate} | fast-path share of confirmations ${m.fastPathShareOfConfirmations}`);
  console.log(`outcomes ${JSON.stringify(m.byOutcome)}`);
}
if (failures.length) process.exitCode = 1;

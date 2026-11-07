import raw from "./catalog.json";
import type { Risk } from "./types";

export interface SlotDef {
  type: "workerSelector" | "enum" | "number" | "string" | "date" | "email";
  required: boolean;
  ask?: string;
  values?: string[];
  valuesFrom?: "queryKinds" | "pages";
  min?: number;
  max?: number;
}

export interface ActionDef {
  description: string;
  risk: Risk;
  changesPayData?: boolean;
  slots: Record<string, SlotDef>;
  summary: string;
  examples: { say: string; steps: { action: string; args: Record<string, unknown> }[] }[];
}

export interface Catalog {
  version: number;
  selectorFilters: Record<string, string>;
  queryKinds: Record<string, string>;
  pages: string[];
  actions: Record<string, ActionDef>;
  flowExamples: { say: string; steps: { action: string; args: Record<string, unknown> }[] }[];
  confirmation: { fillers: string[]; affirm: string[]; deny: string[] };
  promptRules: string[];
}

export const CATALOG = raw as unknown as Catalog;
export const ACTION_NAMES = Object.keys(CATALOG.actions);

/** Allowed values for an enum slot (resolving valuesFrom references). */
export function slotValues(slot: SlotDef): string[] | undefined {
  if (slot.values) return slot.values;
  if (slot.valuesFrom === "queryKinds") return Object.keys(CATALOG.queryKinds);
  if (slot.valuesFrom === "pages") return CATALOG.pages;
  return undefined;
}

const nullable = (s: Record<string, unknown>) => ({ anyOf: [s, { type: "null" }] });

const SELECTOR_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["scope", "names", "city", "except", "filter", "minUnits"],
  properties: {
    scope: { type: "string", enum: ["all", "names", "city", "filter"] },
    names: { type: "array", items: { type: "string" } },
    city: nullable({ type: "string" }),
    except: { type: "array", items: { type: "string" } },
    filter: nullable({ type: "string", enum: Object.keys(CATALOG.selectorFilters) }),
    minUnits: nullable({ type: "number" }),
  },
};

function slotSchema(slot: SlotDef): Record<string, unknown> {
  switch (slot.type) {
    case "workerSelector":
      return nullable(SELECTOR_SCHEMA);
    case "enum":
      return nullable({ type: "string", enum: slotValues(slot) });
    case "number":
      return nullable({ type: "number" });
    default:
      return nullable({ type: "string" });
  }
}

/** Union of every slot across all actions; each action only uses its own keys. */
function allSlots(): Record<string, SlotDef> {
  const out: Record<string, SlotDef> = {};
  for (const a of Object.values(CATALOG.actions)) for (const [k, s] of Object.entries(a.slots)) out[k] ??= s;
  return out;
}

/** JSON schema for the planner's output, generated from the catalog. */
export function planSchema(): Record<string, unknown> {
  const slots = allSlots();
  const props = Object.fromEntries(Object.entries(slots).map(([k, s]) => [k, slotSchema(s)]));
  return {
    type: "object",
    additionalProperties: false,
    required: ["language", "answersPending", "notUnderstood", "steps"],
    properties: {
      language: { type: "string" },
      answersPending: nullable({ type: "boolean" }),
      notUnderstood: nullable({ type: "string" }),
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["action", "args"],
          properties: {
            action: { type: "string", enum: ACTION_NAMES },
            args: { type: "object", additionalProperties: false, required: Object.keys(props), properties: props },
          },
        },
      },
    },
  };
}

function slotDoc(name: string, s: SlotDef): string {
  const vals = slotValues(s);
  const kind = s.type === "workerSelector" ? "worker selector" : vals ? `one of: ${vals.join(", ")}` : s.type;
  return `${name} (${kind}${s.required ? ", required" : ", optional"})`;
}

/** The action reference that goes into the planner prompt. */
export function renderActionDocs(): string {
  return Object.entries(CATALOG.actions)
    .map(([name, a]) => `- ${name} [${a.risk}]: ${a.description}\n    slots: ${Object.entries(a.slots).map(([k, s]) => slotDoc(k, s)).join("; ") || "none"}`)
    .join("\n");
}

const compactArgs = (args: Record<string, unknown>) => JSON.stringify(args);

/** Few-shot examples from the catalog (examples teach the format; they are not lookup tables). */
export function renderExamples(): string {
  const lines: string[] = [];
  for (const a of Object.values(CATALOG.actions)) {
    for (const ex of a.examples.slice(0, 1)) lines.push(`"${ex.say}" -> ${ex.steps.map((s) => `${s.action} ${compactArgs(s.args)}`).join(" | ")}`);
  }
  for (const ex of CATALOG.flowExamples) lines.push(`"${ex.say}" -> ${ex.steps.map((s) => `${s.action} ${compactArgs(s.args)}`).join(" | ")}`);
  return lines.join("\n");
}

export const SELECTOR_FILTER_DOCS = Object.entries(CATALOG.selectorFilters)
  .map(([k, v]) => `${k}: ${v}`)
  .join("; ");

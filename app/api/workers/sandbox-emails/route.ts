import { OWNER, respond } from "@/app/lib/server/http";
import { assignSandboxEmails } from "@/app/lib/server/sandbox";

/** POST: give active employees with no PayPal email a sandbox test address (never overwrites an email). Owners only. */
export async function POST() {
  return respond(() => ({ sandbox: assignSandboxEmails() }), OWNER);
}

import type { Metadata } from "next";
import { LegalDoc, List, Section } from "../LegalDoc";

export const metadata: Metadata = { title: "Privacy Policy · BolPay" };

const PROVIDERS = [
  { name: "Supabase", purpose: "Sign-in and account roles", data: "Name, email, password hash, role" },
  { name: "PayPal", purpose: "Sending approved payouts", data: "Worker PayPal email, payout amount, pay period" },
  { name: "ElevenLabs", purpose: "Speech to text, and spoken replies", data: "Voice recordings, reply text" },
  { name: "Groq", purpose: "Understanding voice and typed commands", data: "Command text, names and cities of active workers" },
];

export default function PrivacyPage() {
  return (
    <LegalDoc
      title="Privacy Policy"
      updated="11 November 2026"
      intro={
        <>
          <p>
            This policy explains what BolPay collects, why, and who it is shared with. Businesses use BolPay to record attendance and
            pay their workers. The business decides which worker details go into BolPay, and BolPay processes those details on the
            business&apos;s behalf.
          </p>
        </>
      }
    >
      <Section id="collect" title="1. What we collect">
        <List>
          <li><strong className="font-medium text-slate-900">Account details:</strong> name, email address, password (stored only as a hash by our sign-in provider) and your role: owner, supervisor or worker.</li>
          <li><strong className="font-medium text-slate-900">Worker records</strong> entered by the business: name, job role, city, phone number, PayPal email address, daily wage, start date and status.</li>
          <li><strong className="font-medium text-slate-900">Work and pay records:</strong> attendance, overtime hours, deliveries or units completed, incentive rules, calculated pay, approval decisions, and PayPal references and statuses.</li>
          <li><strong className="font-medium text-slate-900">Voice commands</strong> from owners and supervisors who use the voice assistant: the recording and its text.</li>
          <li><strong className="font-medium text-slate-900">Technical data:</strong> the cookies that keep you signed in, and server logs of errors and request times.</li>
        </List>
      </Section>

      <Section id="use" title="2. How we use it">
        <List>
          <li>To calculate pay and incentives, and to show each worker their own earnings and payment history.</li>
          <li>To send payouts through PayPal after an owner approves them.</li>
          <li>To understand and carry out voice and typed commands.</li>
          <li>To keep accounts secure and to diagnose problems.</li>
        </List>
        <p>We do not sell personal data, and we do not use it for advertising.</p>
      </Section>

      <Section id="voice" title="3. Voice commands">
        <List>
          <li>Audio is sent to ElevenLabs to be turned into text. BolPay does not keep the recording.</li>
          <li>The text of the command, together with the names and cities of active workers, is sent to Groq so the request can be matched to the right people.</li>
          <li>The assistant&apos;s replies are spoken using ElevenLabs text-to-speech.</li>
          <li>An unfinished conversation is held in server memory for up to 15 minutes, and in your browser tab until you close it or start a new conversation.</li>
          <li>Usage metrics for the assistant record counts and timings, not what was said.</li>
        </List>
      </Section>

      <Section id="sharing" title="4. Service providers">
        <p>We share data only with the providers that run parts of BolPay, and only what each one needs:</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium uppercase tracking-wider text-slate-500">
                <th className="px-3.5 py-2 font-medium">Provider</th>
                <th className="px-3.5 py-2 font-medium">Purpose</th>
                <th className="px-3.5 py-2 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {PROVIDERS.map((p) => (
                <tr key={p.name}>
                  <td className="px-3.5 py-2.5 font-medium text-slate-900">{p.name}</td>
                  <td className="px-3.5 py-2.5">{p.purpose}</td>
                  <td className="px-3.5 py-2.5">{p.data}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p>We may also disclose data when the law requires it.</p>
      </Section>

      <Section id="access" title="5. Who can see what">
        <List>
          <li><strong className="font-medium text-slate-900">Owners</strong> see all workers, wages, rules, payouts and transactions for their business.</li>
          <li><strong className="font-medium text-slate-900">Supervisors</strong> see workers and attendance. They cannot see payouts or transactions, or change wages.</li>
          <li><strong className="font-medium text-slate-900">Workers</strong> see only their own attendance, earnings and payment history.</li>
        </List>
        <p>These rules are checked on the server for every request, not only in the interface.</p>
      </Section>

      <Section id="retention" title="6. How long we keep it">
        <p>
          Account, worker and pay records are kept for as long as the business uses BolPay, because they are payroll and payment
          records. Voice recordings are not stored. Voice conversation state is deleted after 15 minutes without activity.
        </p>
      </Section>

      <Section id="rights" title="7. Your choices">
        <p>
          The business that added you controls your worker record, so ask them first to correct or remove your details. Depending on
          where you live, you may also have the right to request a copy of your data, or to ask for it to be corrected or deleted.
        </p>
      </Section>

      <Section id="security" title="8. Security">
        <List>
          <li>Passwords are handled by Supabase Auth and are never stored in plain text.</li>
          <li>Data moves over encrypted HTTPS connections.</li>
          <li>PayPal and other service credentials stay on the server and never reach the browser.</li>
          <li>Payout amounts and recipients are always taken from server records, never from what the browser sends.</li>
        </List>
      </Section>

      <Section id="changes" title="9. Changes to this policy">
        <p>When this policy changes, we will post the new version here and update the date at the top.</p>
      </Section>

      <Section id="contact" title="10. Contact">
        <p>
          For questions about your worker record, contact the business that gave you access. For questions about this policy, contact
          the BolPay team through that business&apos;s owner.
        </p>
      </Section>
    </LegalDoc>
  );
}

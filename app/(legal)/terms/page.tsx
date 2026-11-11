import type { Metadata } from "next";
import Link from "next/link";
import { LegalDoc, List, Section } from "../LegalDoc";

export const metadata: Metadata = { title: "Terms of Service · BolPay" };

export default function TermsPage() {
  return (
    <LegalDoc
      title="Terms of Service"
      updated="11 November 2026"
      intro={
        <p>
          These terms apply to everyone who uses BolPay: business owners, the supervisors they add, and workers who sign in to see their
          pay. By using BolPay you agree to them. How we handle personal data is covered in the{" "}
          <Link href="/privacy" className="font-medium text-teal-700 hover:underline">Privacy Policy</Link>.
        </p>
      }
    >
      <Section id="service" title="1. The service">
        <p>
          BolPay helps businesses record attendance, calculate pay and incentives, approve payouts and send them through PayPal. It
          includes an optional voice assistant that can carry out the same tasks from spoken or typed commands.
        </p>
      </Section>

      <Section id="accounts" title="2. Accounts">
        <List>
          <li>Accounts are invite-only. A business owner decides who gets access and in which role.</li>
          <li>Keep your password private. You are responsible for activity under your account.</li>
          <li>Owners are responsible for removing access for people who should no longer have it.</li>
        </List>
      </Section>

      <Section id="business" title="3. The business's responsibilities">
        <List>
          <li>Enter accurate worker details, wages and attendance.</li>
          <li>Have each worker&apos;s permission to store their details and to pay them through PayPal.</li>
          <li>Comply with the wage, tax and employment laws that apply to you. BolPay calculates pay from the rules you set; it does not file taxes or give legal advice.</li>
        </List>
      </Section>

      <Section id="payouts" title="4. Payouts">
        <List>
          <li>Payouts are sent with PayPal Payouts from the PayPal account connected to your workspace. BolPay never holds your funds.</li>
          <li>Only owners can approve payouts. Check each amount and recipient before you approve.</li>
          <li>Once PayPal accepts a payout, BolPay cannot reverse it. Failed payouts can be retried after the cause is fixed.</li>
          <li>Amounts are shown in rupees and sent in US dollars at the exchange rate recorded on each transaction.</li>
          <li>PayPal&apos;s own terms and fees apply to every payout.</li>
        </List>
      </Section>

      <Section id="voice" title="5. The voice assistant">
        <p>
          Speech recognition and language models can mishear or misread a request. Before making changes, the assistant shows what it
          plans to do and asks you to confirm. Any step that moves money needs a separate confirmation that states the exact amount.
          Read the plan before you confirm it.
        </p>
      </Section>

      <Section id="use" title="6. Acceptable use">
        <p>You agree not to:</p>
        <List>
          <li>access accounts or data you have not been given access to;</li>
          <li>pay anyone without their consent, or use BolPay to move money for an unlawful purpose;</li>
          <li>interfere with the service, probe it for weaknesses without permission, or overload it;</li>
          <li>enter content that is unlawful or that you have no right to share.</li>
        </List>
      </Section>

      <Section id="availability" title="7. Availability and changes">
        <p>
          We work to keep BolPay running and accurate, but we cannot promise it will be uninterrupted or error-free. We may change or
          remove features over time.
        </p>
      </Section>

      <Section id="liability" title="8. Liability">
        <p>
          BolPay is provided as it is. To the extent the law allows, we are not liable for indirect or consequential losses, or for
          payouts approved with incorrect amounts or recipients.
        </p>
      </Section>

      <Section id="ending" title="9. Ending use">
        <p>
          You can stop using BolPay at any time. We may suspend access for accounts that break these terms or put other users or
          workers at risk.
        </p>
      </Section>

      <Section id="updates" title="10. Changes to these terms">
        <p>When these terms change, we will post the new version here and update the date at the top.</p>
      </Section>
    </LegalDoc>
  );
}

import Link from 'next/link'

export const metadata = { title: 'Privacy Policy — Ivy' }

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: May 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Who controls your data</h2>
            <p>Ivy AI Ltd is the data controller for information collected through the Ivy service. Contact us at <a href="mailto:privacy@ai4e1.net" className="text-primary underline underline-offset-2">privacy@ai4e1.net</a> for any data-related queries.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. What we collect</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Account information:</strong> name, email address, phone number, timezone, region.</li>
              <li><strong>Health and wellness data:</strong> workout plans, completion logs, energy/mood scores, life markers, your stated goals and motivations.</li>
              <li><strong>Call data:</strong> voice call recordings, transcripts, AI-generated summaries and behavioural insights.</li>
              <li><strong>Payment information:</strong> processed via Stripe — we do not store card numbers.</li>
              <li><strong>Usage data:</strong> how you interact with the app, features used, session timing.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Why we collect it</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>To provide the service:</strong> scheduling calls, personalising coaching, processing donations. Lawful basis: contract.</li>
              <li><strong>To improve Ivy:</strong> analysing patterns to make coaching more effective. Lawful basis: legitimate interests.</li>
              <li><strong>To comply with law:</strong> financial records, GDPR obligations. Lawful basis: legal obligation.</li>
            </ul>
            <p className="mt-3">We never sell your data to third parties.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Who we share it with</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li><strong>Retell AI:</strong> voice call processing. Your call audio and transcripts pass through their infrastructure.</li>
              <li><strong>Twilio:</strong> telephony (call routing, SMS/WhatsApp).</li>
              <li><strong>Stripe:</strong> payment processing.</li>
              <li><strong>Every.org:</strong> charity donation dispatch — your name and donation amount are shared.</li>
              <li><strong>Anthropic:</strong> AI analysis of call transcripts for coaching personalisation.</li>
              <li><strong>SendGrid:</strong> transactional emails.</li>
            </ul>
            <p className="mt-3">All processors are contractually bound to process data only on our instructions and to maintain appropriate security standards.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. How long we keep it</h2>
            <p>We retain your account data for as long as you have an active account, plus 90 days after deletion to allow for recovery requests. Call transcripts and recordings are retained for 12 months and then deleted. Financial records are kept for 7 years as required by UK law.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Your rights (GDPR)</h2>
            <p>You have the right to:</p>
            <ul className="list-disc pl-5 space-y-1 mt-2">
              <li><strong>Access</strong> the data we hold about you — use the "Export My Data" option in Settings.</li>
              <li><strong>Delete</strong> your account and all associated data — use "Delete Account" in Settings or email us.</li>
              <li><strong>Correct</strong> inaccurate data — update your profile in Settings or contact us.</li>
              <li><strong>Restrict or object</strong> to processing — contact us at privacy@ai4e1.net.</li>
              <li><strong>Data portability</strong> — we provide a JSON export of your data on request.</li>
              <li><strong>Withdraw consent</strong> where processing is based on consent.</li>
            </ul>
            <p className="mt-3">You have the right to lodge a complaint with the ICO (ico.org.uk) if you believe we are not handling your data correctly.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. International transfers</h2>
            <p>Some of our service providers (including Anthropic and Retell AI) process data in the United States. These transfers are covered by standard contractual clauses or equivalent adequacy mechanisms.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Security</h2>
            <p>We use encryption in transit (TLS) and at rest. Access to personal data is limited to staff and systems that need it. We conduct regular security reviews. In the event of a breach that affects your rights, we will notify you and the ICO within 72 hours as required by GDPR.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Cookies</h2>
            <p>The Ivy web app uses session cookies for authentication and localStorage for user preferences. We use PostHog for analytics, which sets cookies to track usage. You can disable analytics cookies in your browser settings.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">10. Changes to this policy</h2>
            <p>We will notify you by email of any material changes to this policy at least 14 days before they take effect.</p>
          </section>

          <section>
            <p>Data queries: <a href="mailto:privacy@ai4e1.net" className="text-primary underline underline-offset-2">privacy@ai4e1.net</a></p>
          </section>

        </div>
      </div>
    </div>
  )
}

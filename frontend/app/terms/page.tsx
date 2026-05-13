import Link from 'next/link'

export const metadata = { title: 'Terms of Service — Ivy' }

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <div className="mb-10">
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            ← Back
          </Link>
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: May 2026</p>

        <div className="prose prose-invert prose-sm max-w-none space-y-8 text-foreground/80 leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">1. Who we are</h2>
            <p>Ivy is an AI accountability coaching service operated by Ivy AI Ltd. By creating an account you are entering into a legal agreement with us. If you have questions, contact us at <a href="mailto:hello@ai4e1.net" className="text-primary underline underline-offset-2">hello@ai4e1.net</a>.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">2. The service</h2>
            <p>Ivy provides AI-powered accountability coaching via voice calls, messaging, and a web application. A portion of your subscription fee is directed to charities you choose through our Impact Wallet. Ivy is not a medical service, mental health service, or personal training service. If you are in crisis, please contact the Samaritans on 116 123 or your local emergency services.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">3. Subscriptions and billing</h2>
            <p>Subscriptions are billed monthly in advance. You may cancel at any time from your settings — your access continues until the end of the current billing period. We do not offer refunds for partial periods. All prices are shown inclusive of VAT where applicable. We may change our prices with 30 days' notice.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">4. Impact Wallet and donations</h2>
            <p>Your Impact Wallet allocates a portion of your subscription to charitable donations when you complete your commitments. Donations are processed via Every.org and dispatched monthly. We cannot guarantee specific charity impact outcomes. Donation amounts are shown in good faith and are subject to change. Unused wallet funds in a given month do not roll over.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">5. Voice calls and recordings</h2>
            <p>Calls are made using AI voice technology. Calls may be recorded for quality assurance and to improve the service. Call transcripts are stored and used to personalise your coaching experience. You may request deletion of your call history by contacting us or using the data export and deletion tools in your account settings.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">6. Acceptable use</h2>
            <p>You must be 18 or older to use Ivy. You agree not to misuse the service, share your account, attempt to reverse-engineer the platform, or use it in any way that could harm others. We reserve the right to suspend accounts that violate these terms without refund.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">7. Limitation of liability</h2>
            <p>Ivy is provided "as is." We are not liable for any indirect, incidental, or consequential damages arising from your use of the service. Our total liability to you in any 12-month period is limited to the amount you paid for the service in that period. Nothing in these terms limits liability for death or personal injury caused by negligence, or fraud.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">8. Governing law</h2>
            <p>These terms are governed by the laws of England and Wales. Any disputes will be subject to the exclusive jurisdiction of the courts of England and Wales.</p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-foreground mb-3">9. Changes to these terms</h2>
            <p>We may update these terms from time to time. We will notify you of material changes by email. Continued use of the service after notification constitutes acceptance of the updated terms.</p>
          </section>

          <section>
            <p>Questions? <a href="mailto:hello@ai4e1.net" className="text-primary underline underline-offset-2">hello@ai4e1.net</a></p>
          </section>

        </div>
      </div>
    </div>
  )
}

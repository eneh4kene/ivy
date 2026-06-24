
Remember Ivy? We need to Redo the business model for it so that revenue/profits are not locked into the saas pricing, should a whale decide to enter the space/compete and bring the price to where we can't reach. What if Google decides to enter and make it free cos they can afford after all Gemini replies/responds on people's phones for free.... what do you think?

19 Jun
This is a genuinely important strategic question and the threat model is real. Let me think through it properly.

The Core Threat
You're describing commoditisation risk — when a well-capitalised incumbent (Google, Meta, Apple, Microsoft) enters your space and either makes your product free or prices it so low that your SaaS margin disappears. This has happened to every SaaS category that got big enough to attract platform attention. Dropbox, Zoom, note-taking apps, to-do lists — all felt this.

For Ivy specifically, the risk is acute because:

The core mechanic (an AI that holds you accountable) is not technically hard to replicate
Google already has Gemini embedded in Android with zero incremental distribution cost
Apple has Siri + iOS + Health + Reminders — they could ship "accountability mode" in a WWDC keynote
Meta has WhatsApp + Messenger — they could do this as a feature overnight
So the SaaS subscription alone is not a defensible moat. You're right to re-examine this now, before you've built the entire go-to-market around it.

What Actually Creates Durable Revenue
There are four categories of revenue that are much harder for a platform player to kill:

1. Data Network Effects → Monetisable Credential
This is where Ivy has something the platforms genuinely can't replicate easily — longitudinal, structured follow-through data tied to a specific person over time.

The Ivy Score (which we parked at Phase 3) becomes the moat. If Ivy is the place where your commitments live and your track record compounds, it becomes a portable credential — think of it like a financial credit score but for personal execution.

Monetisation paths:

Employers, insurers, lenders, or coaches pay to query a user's Ivy Score (with consent)
Users pay a premium to make their score portable and verifiable (export, share, embed in a LinkedIn profile)
B2B HR/performance platforms licence the scoring API
Google can't replicate this because they'd need years of your commitment history to generate a credible score — and users won't trust Google with that data the same way.

2. The Impact Wallet as a Financial Product
The charitable donation mechanic is currently a retention feature. It could become a financial infrastructure play.

If Ivy holds real money (even micro-amounts) tied to behaviour, you can:

Partner with charities and take a small processing margin (like a payments layer)
Create impact bonds — users lock funds, earn them back (or donate them) based on verified goal completion
Corporate ESG budgets could fund employee Impact Wallets — companies pay Ivy to run accountabilty programmes tied to measurable behaviour change (health, upskilling, etc.)
This is fintech-adjacent and platforms generally don't want to touch it due to regulation
Google making Gemini free doesn't kill a product that holds and moves money with FCA-adjacent features.

3. Ivy Circles as a Social Primitive → B2B Group Product
Ivy Circles right now are a community retention mechanic. They could become a sold product in their own right.

Corporate wellness teams buy Circle licences for employee accountability groups
Therapy practices / coaching firms run Circles for client cohorts
Schools and universities buy Circle licences for student cohort accountability
AA/NA-style recovery communities use Circles as infrastructure
This is the Slack model — the core product is free/cheap, but the group coordination layer becomes the enterprise product. And crucially, the value is in the social graph within the circle — that data is not portable to Google.

4. Coaching Marketplace (Two-Sided Platform)
Rather than Ivy being the coach, Ivy becomes the infrastructure layer for human coaches.

Human coaches (life coaches, fitness coaches, therapists) use Ivy as their operating system — client tracking, commitment logging, session notes
They pay Ivy a SaaS fee or a revenue share on what they charge clients
Clients discover coaches through Ivy (marketplace discovery fee or lead gen)
This is the Mindbody / Calendly / Notion model. If Google enters the consumer accountability space, they just become a distribution channel into your marketplace, not a competitor to it.

Revised Business Model Architecture
Here's how I'd restructure Ivy's revenue so no single layer is killable:

Layer	Revenue Type	Who Pays	Platform-Proof?
Consumer SaaS (Tiers 1–3)	Subscription	Individual users	❌ Vulnerable
Ivy Score credential	API access fees + user premium	Employers, coaches, users	✅ Strong
Impact Wallet processing	Transaction margin + corporate ESG	Charities, corporates	✅ Strong
Circles B2B	Group licences	Companies, clinics, schools	✅ Strong
Coach marketplace	Rev share + SaaS for coaches	Coaches	✅ Strong
Data insights (anonymised, consented)	B2B analytics	Insurers, HR platforms	✅ Strong
The SaaS tier becomes your acquisition funnel rather than your primary revenue engine. You give it away aggressively (or let Google commoditise it) and you monetise the layers above it.

The Strategic Reframe
Stop thinking of Ivy as an accountability app. Start thinking of it as the world's first behavioural follow-through infrastructure.

Apps get commoditised. Infrastructure gets acquired or becomes a standard. The goal is to make Ivy the layer that every coach, HR platform, insurer, and wellness company has to plug into — because that's where the longitudinal commitment data lives.

If Google makes the consumer product free, that's actually fine — because they'll still have to query Ivy's API to know whether the user actually did what they said they would.

Immediate Implications for the Build
A few things this changes in the near term:

Ivy Score needs to be accelerated, not parked. It's the moat, not a Phase 3 nice-to-have.
The Impact Wallet needs a real financial partner early — even a charity API integration creates switching costs that Google won't replicate.
B2B Circles should be a separate SKU with a separate sales motion, not just a feature of the consumer product.
Coach onboarding should be built into the roadmap explicitly so you have a two-sided network before a platform player arrives.
What's your instinct on which of these layers feels most natural to prioritise first given where Victor is on the build?

Very strong just a few things.... I've parked Ivy score cos well the same reason I hate LinkedIn, people are too formal and not really themselves. Accountability requires honesty about vulnerability. 
Secondly, I've parked the impact wallet and gone with stickers staking mechanism because research shows people tend to respond better when there’s something to loose and if they paid anyway from the start, it takes away from the "teeth" of the experience. That leaves us with B2b and coach options etc... what do you think now?

19 Jun
You're right on both counts and the reasoning is sharp.

On Ivy Score — the LinkedIn problem is real. The moment accountability becomes performative, it stops working. A score you share publicly incentivises looking accountable rather than being accountable. It corrupts the core mechanic. Good park.

On sticker staking — this is actually the stronger design. Loss aversion is roughly 2x more motivating than equivalent gain (Kahneman). If you've already paid for stickers and you're about to lose them because you didn't follow through, that's visceral in a way that "earn a reward" never is. And you're right that pre-paying for an impact wallet takes the teeth out — it becomes charity cosplay rather than genuine skin in the game. The staking model keeps the stakes personal and immediate.

So the defensible architecture without those two layers is really:

B2B Circles + Coach Infrastructure = the actual business.

Here's how I'd think about it now:

The Real Model
Consumer product = top of funnel, not the revenue engine
The individual subscription exists to:

Build the user base coaches and companies want to reach
Generate the longitudinal behavioural data that makes the B2B product credible
Let users experience Ivy before their employer or coach brings them in
If Google enters and makes consumer accountability free, your response is good — more users in the funnel, more coaches needed, more enterprise demand.

Coaches as the primary revenue layer
This is the one I'd prioritise hardest right now because it:

Requires no regulatory friction (unlike fintech)
Has a clear, immediate buyer with budget and pain
Creates a two-sided network that compounds — more coaches bring more clients, more clients attract more coaches
Gives you professional validation that a consumer app never gets
The model here is simple: coaches pay Ivy to run their client accountability infrastructure. They get dashboards, commitment logs, session prep summaries, alert triggers when a client goes quiet. Clients get the Ivy experience they'd pay for anyway — but the coach is the buyer.

Pricing doesn't need to be SaaS-per-seat. It could be revenue share — Ivy takes a percentage of what the coach charges clients who are on the platform. That aligns incentives and means Ivy only wins when the coach wins.

This is platform-proof because Google cannot replicate the coach relationship. They can build an accountability chatbot. They cannot replace the human professional who uses Ivy as their operating system.

B2B Circles as the enterprise wedge
Circles sold to companies, clinics, recovery programmes, or universities are your enterprise motion. One corporate client could be worth what hundreds of consumer subscribers generate.

The key insight here is that group accountability is socially stickier than individual accountability. Once a team or cohort is running on Ivy Circles, the switching cost isn't just the product — it's the social fabric of the group. Google entering the space doesn't dissolve that.

The framing that works best for enterprise is not "wellness app" — it's behavioural change infrastructure. HR buys it for upskilling cohorts. Clinics buy it for post-treatment compliance. Universities buy it for dissertation or project cohorts. Each vertical has its own budget line and procurement path.

What This Means Structurally
You now have a three-layer model that's genuinely platform-resistant:

Layer	Who Pays	Why Platform Can't Kill It
Consumer SaaS	Individuals	Funnel, not core revenue
Coach Infrastructure	Professional coaches	Human relationship layer
B2B Circles	Companies, clinics, universities	Social switching cost + procurement inertia
The consumer tier feeds the other two. You don't need it to be your margin engine — you need it to be your acquisition machine.

The One Thing I'd Push On
The sticker staking mechanic is strong but it needs a moment of real friction to work — something that makes losing stickers feel genuinely bad, not just mildly disappointing. That experience design decision is probably the most important product call you haven't fully resolved yet. What does losing stickers actually feel like in the product? Is there a social visibility component — do your Circle members see when you've lost them? Because if so, that's where the teeth really come from, and it also reinforces why Circles are sticky.

Okay so I've built the coach interface and the user interface ready for pilot. I need to be as strategic as possible. I want to start with a coach and his clients to test the core loop for a 2 weeks. Then approach a business to test the core loop as well for another two weeks for B2B. What do you think

19 Jun
This is the right sequencing. Two clean pilots, different buyer types, four weeks total — that's lean and purposeful. Let me pressure test it and sharpen it.

Why This Sequencing Is Correct
Coach-first is the right call because:

A single coach gives you a controlled relationship — you can debrief them properly, they'll give you honest feedback because their professional reputation depends on the tool working
Coaches are articulate about behaviour change — they'll name problems you didn't know existed
If the core loop breaks, the blast radius is small — one coach, handful of clients, not a whole company's HR rollout
You get qualitative depth before you need quantitative breadth
B2B second is right because by then you'll have at least one round of product fixes from the coach pilot, and you'll have a real coach testimonial to show the business contact.

What To Be Strategic About
Choosing the right coach
This is the most important decision of the four weeks. You don't want just any coach — you want someone who:

Already has an active client roster (minimum 5-8 clients willing to participate)
Has a problem Ivy directly solves — the gap between sessions where clients drift and lose momentum
Is credible enough that their endorsement means something later
Is honest enough to tell you when something doesn't work
Ideally this is someone in your network where the relationship gives you licence to have hard conversations. A coach you found cold is less useful than one who already trusts you.

What to offer them: Free access for life to the coach interface in exchange for two weeks of structured feedback. Frame it as co-building, not beta testing. Coaches have ego — make them feel like a founding partner, not a guinea pig.

Defining the core loop explicitly before you start
Before the pilot begins, write down in one paragraph what the core loop is supposed to do. Something like:

"User sets a commitment. Ivy holds them to it between coaching sessions. Coach sees whether they followed through before the next session. Session starts from truth, not performance."

Then define: what does success look like at the end of two weeks? Not vanity metrics. Real ones:

Did the coach change how they ran sessions because of Ivy data?
Did clients follow through more than their baseline?
Did anyone lose stickers — and did it change behaviour?
Would the coach pay for this after the pilot?
If you don't define this upfront, the pilot becomes a demo, not a test.

The B2B target
For the business pilot, you want a company where:

The buyer is not in procurement — you need someone with budget autonomy, probably a Head of People, L&D lead, or founder
The use case is specific, not generic wellness — a cohort doing something together (new manager training, a sales team on a 30-day push, a graduate intake)
They're small enough to move fast but credible enough to be a reference client
Twelve to twenty employees in the cohort is the sweet spot. Too small and the social dynamics of Circles don't activate. Too large and you can't manage the pilot personally.

What to offer them: Free pilot, you facilitate the onboarding, you give them a written report at the end on cohort behavioural patterns. That report has value to them and costs you nothing but time.

The One Risk To Manage
Four weeks is short. The danger is that you reach the end without a clean answer because the pilots were too unstructured — lots of activity, not enough signal.

Guard against this by:

Running a 15-minute debrief call with the coach at day 7 and day 14 — structured questions, not a chat
Getting written feedback from at least 3 clients at the end of week two, even just five bullet points each
For the B2B pilot, having the buyer score Ivy against their original problem at the end — did it do what they needed?
That gives you something to take into fundraising conversations and future sales calls. "We ran two pilots, here's what we learned, here's what changed, here's what the coach said" is a completely different conversation to "we have a product, want to try it?"

After The Four Weeks
You'll come out with:

A validated core loop (or a clear picture of what's broken)
One coach who is potentially a paying customer and a reference
One business that is potentially a case study
Enough signal to decide whether to push the coach channel or the B2B channel harder first
Which do you have more traction on right now — a coach contact or a business contact?



Claude Fable 5 is currently unavailable.
Learn more(opens in new tab)




Claude is AI and can make mistakes. Please double-check responses.

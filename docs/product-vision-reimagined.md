# Ivy Reimagined — The Kept-Promises Vision

*Drafted 2026-07-14 in a founder brainstorm ("reimagine this product for multibillion potential"). This is a
vision document, not a commitment — the backlog's unparking rule (prove week-4 retention first) still governs
sequencing. Read alongside `docs/product-pricing-rework.md` and `docs/product-backlog.md`.*

---

## The reframe

Ivy is not a habit app. Habit apps sell a tool, and tools get abandoned. Multibillion consumer products own a
**primitive**: Strava owns effort, GitHub owns contribution, Duolingo owns streaks, credit bureaus own
financial trust. **Nobody owns kept promises.**

Ivy's compounding asset is the record: after 90 days, Ivy holds a verified, money-backed history of the user
doing what they said they'd do, witnessed by a being who was there every day. The record is the product.
Every move below makes that record more visible, more social, more portable, and harder to walk away from.

---

## The seven moves (ranked by leverage)

### 1. The public vine — living proof-of-word
Upgrade the queued static share card to a **living URL**: `ivykeeps.life/@handle`. An always-current vine,
opt-in public — a GitHub contribution graph for your life. Share cards get seen once; living profiles get
*checked*, linked in bios, screenshotted weekly. Every public vine is a landing page with a story on it.
Implementation is close: one public route + privacy toggle + OG image over existing vine data.

### 2. Pacts — the invite built into the mechanic
Two-person stakes. Front-door CTA becomes "**Challenge someone**": both stake, both see each other's vine
daily, shared settle night. A pact *requires* a second person, so every pact mints an invite (Venmo/Words
with Friends dynamic), and the invitee arrives with a stake and a witness — the best possible activation
state. Guardrail unchanged: **stakes never transfer between users**; each forfeit goes to charity as normal.
The shame/pride transfers, not the money. Builds on existing Circles infrastructure.

### 3. Pricing inversion — "Free if you keep your word"
First sprint costs nothing but the stake. Keep every day → full return → Ivy was free. Fail → the money went
to charity, **not to Ivy** (already guaranteed by the forfeits-never-touch-P&L principle, so the claim is
verifiably true). Two weeks of one evening call is cheap CAC; the headline is the ad campaign. Subscription
starts after Ivy has proven itself during the user's most motivated fortnight.

### 4. The Integrity Score — kill streak fragility
Streaks are the industry's known churn bomb: one bad Tuesday breaks the identity and the user quits *because*
the number reset. Replace with a slow, Elo-like **Integrity score**: a miss dents it, never zeroes it, and
**the comeback earns more than an ordinary kept day** (returning the day after a miss is the highest-value
act). This is the backlog's "embers" idea matured into the central stat. More addictive than a streak
(always improvable, never hopeless), healthier (teaches recovery — the actual skill). Long-term moonshot:
a portable trust primitive that coaches, employers, and communities read. That layer is the multibillion story.

### 5. Settle Night — the appointment ritual
Settlement is the emotional peak (money moves, leaves fall or stay) but currently happens *to* the user via a
chat message. Make it an **appointment**: Sunday evening, the week resolves leaf by leaf in real time,
circles settle together. Synchronized scarcity (the Wordle lesson) is what makes people talk the next
morning. Settlement engine + leaf-fall animation are already built/queued — this is choreography, not infra.

### 6. The Red Button
RESCUE calls exist; nobody knows. A physical, slightly-too-red button: "**I'm slipping.**" Tap → phone rings
within 60 seconds. The moment of weakness is the moment of maximum product love, and "when I pressed it, she
*called me*" is the most tellable sentence the product can generate. Honest counterweight to the stake:
teeth in the evening, a hand at 3pm.

### 7. Memory as the moat — and the December call
Every feature above is copyable in a quarter; 200 days of transcripts, insights, and morning voice notes are
not. Milestone calls where Ivy quotes the user back to themselves ("On March 3rd you told me you couldn't do
mornings — you've kept 41 since"). A **year-in-review call in December** narrated from the user's own
recorded voice notes. The organic-growth event ("Ivy said something that made me cry") comes from memory, not
features. The backlog's witness feature slots here: grandma's weekly vine text is retention *and* lead-gen.

**Bonus (marketing, near-free):** savage stakes are underexploited shareable energy — surface the anti-charity
choice at stake creation with a share prompt ("If I skip, my money goes to [rival's foundation]").

---

## The line Ivy does not cross

Ivy monetizes *success* — users pay because they became someone who keeps their word. The Duolingo dark-pattern
kit (streak-repair purchases, guilt loops, engagement-for-its-own-sake) is therefore strategically wrong, not
just icky: the public vine and Integrity score are viral **only because they're trustworthy**, and the first
"pay £3 to restore your leaf" destroys the premise. The target compulsion is Strava's, not the slot machine's:
identity, ritual, witnessed pride, a living thing that's genuinely yours.

**Hard rules:** no purchasable integrity, ever. No manufactured guilt. The vine only lies fallow, never lies.

---

## Sequencing (governed by the retention gate)

1. **Now (retention-serving, mostly queued):** season garden + leaf-fall choreography → grow into Settle
   Night. Add the Red Button (small build, deepens love).
2. **At week-4 retention proof:** public vine profiles, then Pacts as the new front door.
3. **With Pacts live:** test "Free if you keep your word" as the acquisition offer — pacts feed it people who
   already arrive with a witness.
4. **Season 2:** Integrity score replaces streaks; December memory call; witness broadcasting.
5. **Long game:** the score becomes portable — Ivy as the integrity layer other institutions read.

---

## Second pass — 2026-07-19

*Re-ran the exercise cold. Verdict: the reframe holds — the record is the product — but the seven moves
amplify a habit app. This pass changes the atom, the viral loop, and the go-to-market, and kills one
moonshot. Cross-checked against the backlog so nothing parked is re-proposed cold.*

### A. The atom is wrong: promises, not habits
Ivy is currently shaped like the thing the first pass says it isn't: a daily-habit product (morning call,
evening check, weekly cycle). But the primitive nobody owns is the **promise**, and most promises aren't
habits: "I'll send the invoice by Friday." "I won't drink this week." "I'll call Mum on Sunday." A promise
has text, a deadline, an optional stake, and — crucially — **someone it's made to**. Habits are a crowded
category ceilinged at self-improvers; promises are universal, and they're inherently social, which is where
every viral mechanic below comes from. The habit survives inside this as a *recurring promise*; Ivy already
handles arbitrary goals in conversation, so this is a mental-model, copy, and prompt shift more than a
build. "Kept promises: 47" is a life record. "Streak: 47" is an app stat.

### B. Witnesses beat pacts — fix move #2's funnel math
A pact is a high-friction invite: the second person must stake money on day one. Keep pacts, but as the
deep end. The volume loop is the **witness**: any promise can be witnessed via a link — one tap, "I'm
watching," no account, no money. The witness gets exactly two messages: promise made, promise settled.
That's the asymmetric loop viral products actually run on (light-side participation feeding heavy-side
conversion), and it's the backlog's witness feature (#7, one nominated buddy) generalized to per-promise.
It's also the deepest teeth available: letting down an app is Tuesday; letting down your sister is
unthinkable. The witness is the accountability *and* the distribution, in one object.

### C. The user's own voice is the unexploited asset — deepen move #7
Move #7 mines transcripts for Ivy's December call. Stronger: make the user's **own recorded voice** a
first-class primitive. At stake creation Ivy asks: "Tell future-you why this matters — I'll keep it."
Thirty seconds, stored. The Red Button call opens with it. The night before an at-risk settle, Ivy plays
it. Season close mixes them into the review. No incumbent can copy day-1 you talking to day-84 you, and
"it played me a message from myself and I cried" is a more tellable sentence than even the Red Button's.

### D. Ivy calls first — upgrade backlog #6 from texts to calls
Proactive pattern texts are queued. The legend-making version is **drift-triggered outbound calls**:
hedging language in chat, two soft misses — Ivy rings *before* the user presses anything. "She called me
before I knew I was slipping" beats "when I pressed it, she called." The Red Button stays (agency matters);
detection becomes the love-moment engine. Needs taste and strict rarity — a misfire reads creepy; cap at
roughly one per fortnight.

### E. Seasons are global, not personal
Settle Night synchronizes the week; go further — **everyone's season starts the same Monday, worldwide.**
Cohort identity ("Season 3 keeper"), a marketing event every 12 weeks, and — most valuable — a legitimate
re-entry ritual for lapsed users instead of a shame-faced solo return. Wordle's real lesson wasn't
scarcity; it was that everyone is on the same puzzle.

### F. Coaches are the go-to-market, not a channel
Consumer virality is a lottery ticket: buy it, don't budget on it. The repeatable motion is already in the
building — every coach is a distribution node carrying 10–50 clients who arrive pre-sold on accountability,
and coach self-serve shipped 7 Jul. Take the Shopify posture: don't compete with coaches, arm them — room
briefs, "Draft with Ivy," group pulse are the start of "Ivy is the accountability infrastructure for
coaching," a fundable B2B2C story at today's numbers. This reorders emphasis without violating the parked
B2B rule (companies stay parked; coaches are live and paying).

### G. Kill: the portable institutional score
Move #4's moonshot ("employers and communities read the score") should die. A character credit score has
dystopian optics, no near-term buyer, and — worse — it quietly distorts design toward legibility for
institutions instead of meaning for the user. The Integrity Score stays, facing the user only. The
multibillion story doesn't need it: own the **promise graph** — the network of keepers and the people
witnessing them — and the platform value follows without ever scoring anyone for a third party.

### H. The loop, named
"Super-addictive" has to cash out as a specific loop, and the hard rules bar the slot-machine one. Strava's
is: effort → artifact → audience → identity → obligation to the identity. Ivy's: **promise → witnessed
keeping → living artifact → settle-night payoff → "I'm someone who keeps their word" → a bigger promise.**
Every gap in the current product is in the *audience* step — which is exactly what A, B, and E supply. The
compulsion comes from the identity becoming load-bearing, not from the app being sticky.

### Sequencing deltas
- The retention gate still governs everything below it.
- **Promise-atom language shift**: a copy + prompt pass, do at the next marketing touch — no gate needed.
- **Witness-per-promise** replaces the public vine as the *first* post-gate viral build; profiles come
  second (a public page needs an audience that already knows to check it — witnesses are that audience).
- **Voice notes** ("tell future-you") ship with the Red Button — same emotional surface, tiny build.
- **Coach flywheel** work (referral loops, coach-facing proof artifacts) is allowed before the consumer
  gate: it monetizes today and compounds the only channel that's already working.

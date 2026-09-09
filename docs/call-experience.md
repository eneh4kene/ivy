# The Call Experience — designing against numbness

Written 9 Sep 2026, from the question: *if daily calls go numb, is that a
frequency problem or a content problem?*

It is neither. It is a **shape** problem, and that changes what to build.

---

## The diagnosis

Read `evening_completed` in `prompt.service.ts`. The content varies richly —
streak milestones ladder from "3 in a row" to "a full quarter, that's
discipline", stake framing flips on whether a stake exists, the unarmed block
escalates across three tiers, the harvest question is gated on whether today
was a usual friction day.

Now read its structure:

```
1. Confirm it.
2. Get the detail.
3. Tomorrow: what's the plan?
```

Every kept day. Night 4 and night 400. Same three beats, same order, same
"target 30-60 seconds".

**That is where numbness lives.** Not in repeated words — the words are already
well varied — but in an encounter whose *shape* never changes. You can feel a
script even when the wording differs, and arguably *especially* then: when the
words change and the scaffolding does not, the scaffolding becomes the only
constant, and the constant is the thing you start to notice.

The corollary matters as much: **adding more content variation will not fix
this.** That machinery is already sophisticated and it is not what is failing.

## What already varies (do not rebuild it)

- 3 memory layers (within-day, rolling recent, long-term) + `behaviouralAdapter`
  (`most_effective_nudge`, `high_risk_signals`, `preferred_register`)
- Streak milestone ladder; stake vs. stake-less framing; the teeth ladder
- `unarmedBlock` escalation; harvest gating; near-miss recognition
- Track lexicon (de-gymed for sleep/focus/balance)
- Game standing + beats; crown rights; room record; cadence
- Pause and travel protocols; crisis routing
- A Haiku-authored brief that replaces the flow slot entirely on outbound calls

## The five things that do not exist

### 1. Shape, not script

One flow per *outcome* (completed / missed / partial / unknown) means the
outcome picks the shape, and the shape is then fixed. Replace that with a small
set of shapes, chosen per call, with a governor that forbids repetition:

| Shape | What it is |
|---|---|
| `settle_fast` | 15 seconds. "Good. Same again tomorrow?" Nothing needs saying, so nothing is said. |
| `settle_standard` | Today's three beats. Still the workhorse, just no longer the only option. |
| `dig` | One thing, properly. No checklist, no tomorrow-plan. |
| `she_leads` | Opens with something she noticed, not a question. |
| `open_floor` | No agenda at all. "How are you actually?" |
| `push` | Challenges a pattern she has been sitting on. |
| `mark` | Pure acknowledgement. No forward planning, no next step. |

**The governor is the feature, not the shapes.** Never the same shape twice in
a row; weight selection by state (a missed day cannot be `settle_fast`); keep a
rarity budget so the uncommon shapes stay uncommon.

### 2. ~~Duration variance~~ — withdrawn

Originally listed as the cheapest win. It is not a lever at all.

**She cannot measure seconds.** Varying `Target: 30-60 seconds` varies an
instruction she has no way to perceive, so it changes what she is told and not
what happens. Duration is an *output* of how much is on the agenda — a shape
with one beat is short and a shape with four is long — which makes it downstream
of shape (§1), not a thing of its own.

Kept here rather than deleted because the reasoning is the useful part: an
instruction the model cannot observe itself following is not a design.

### 3. Interiority — the honest kind

She has extensive memory *about you* and nothing *of her own*. A relationship
where one side has no inner life flattens regardless of how good their recall
is, and this is the deepest reason a well-informed call can still feel like a
form.

She cannot have a fake personal history. The product is honest that she is AI
("I'm Ivy — AI, yes, but…") and inventing a weekend would break the one thing
that makes the rest believable.

But an AI can honestly have: **noticed** something, formed a **theory**, been
**curious**, and **changed her mind**.

> "I've been trying to work out why your Wednesdays are different from your
> Tuesdays. I think it's that you don't decide Wednesday until Wednesday."

That is interiority she is fully entitled to, it is *true*, and it is the
difference between being tracked and being thought about.

### 4. Relationship stage

Nothing tracks how long you two have known each other. Week 1 and month 6 get
the same register, the same explanations, the same level of shorthand.

A relationship develops compression — inside references, things that no longer
need saying, a shift from explaining the mechanic to just naming it. Streak
milestones are a proxy for this but they measure *performance*, not *acquaintance*:
someone who broke a streak at day 40 and rebuilt to day 3 has known her for six
weeks, and she should sound like it.

Nearly free — the call history is already there.

### 5. Rarity

Nothing in the product is rare. Everything that can happen happens most weeks.

Rarity needs an explicit budget and genuine unpredictability. A rare thing on a
schedule is just a feature with a long interval — the surprise is the mechanism,
so it cannot be routine. (The "Embers" item in `product-backlog.md` is this
instinct already; note the tension flagged there — view-once actively fights
being talked about.)

## The traps

- **Do not add more content variation.** Solved already; not the problem.
- **Do not fake human history.** It breaks the honesty everything else rests on.
- **Do not make every call close an open loop.** That rule was added
  deliberately after the first real call and it is right *most* of the time. If
  it is right *every* time it becomes the tell. Sometimes she should just end.
- **Do not randomise for its own sake.** Variety has to be earned by state.
  Random shape selection reads as inconsistency, not personality — worse than
  sameness, because sameness at least reads as reliable.
- **Gate `push` hard.** Challenging someone in a bad week is how you lose them.
  It must respect `high_risk_signals` and the pause protocol absolutely.

## Sequencing, cheapest first

Revised 9 Sep after the founder's read — interiority is the sharpest thing
here, duration variance is not a thing, and the rest holds.

1. ~~Duration variance~~ — withdrawn, see §2.
2. **Interiority** — SHIPPED. `IvyTheory` model, extracted on the pass that
   already reads every transcript (no extra model call), one open theory at a
   time, and a `held`/`dropped` verdict so she can be wrong on the record.
   Surfaced with an explicit instruction NOT to raise it every call.
3. **Relationship stage** — SHIPPED. Days known + completed-call count, mapped
   to a three-rung register ladder (explain it / name it / leave it unsaid).
4. **Call shapes + the governor.** Next, and the first real build: needs a shape
   recorded per call so the governor can see what it used last.
5. **Rarity budget.** Last, because it is only meaningful once there is a range
   of things for it to make rare.

## The test

Not "did she say something different tonight?" — she already does.

**"Could I have predicted, before answering, roughly how this call would go?"**

Today, after a week, the answer is yes. That is the thing to break.

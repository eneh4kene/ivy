# Ivy Vocabulary Canon

*Created 19 July 2026 from the full-system product audit. Three generations of
vocabulary live in this product (domain-model "workout", track dialects, and the
coming "promise" atom). This table is the single source of truth: any copy pass,
prompt pass, or new surface reads from here. When the promise-atom shift lands
(vision doc, second pass §A), update the last column FIRST, then migrate copy.*

## The rule

- **Domain model** names (Prisma/SQL/service code) do NOT get renamed for
  vocabulary reasons — `Workout`, `StakeCycle`, `armedAt` stay. Renames there
  are migrations, priced separately.
- **User-facing copy and prompts** never say a domain-model word the user's
  track wouldn't say. The track lexicon in `prompt.service.ts` is the runtime
  enforcement of this table for calls; frontend copy must match it by hand.
- **One concept, one word per audience.** If a new surface needs a word not in
  this table, add it here in the same PR.

## Canonical terms

| Concept (domain model) | fitness | focus | sleep | balance | Promise-atom successor |
|---|---|---|---|---|---|
| `Workout` (the daily unit) | session | deep-work block | wind-down | commitment | **promise** (recurring) |
| `armedAt` / arming VN | "arm your day" / voice note | same | same | same | "say your promise out loud" |
| `Workout.status` COMPLETED | kept day | kept day | kept night | kept day | kept promise |
| MISSED / FORFEITED | missed day / slice forfeits | same | slipped night | same | broken promise (the vine never jeers — comeback frame mandatory) |
| `StakeCycle` | your week / the cycle | same | same | same | the week's promises |
| `stakeSliceAmount` | today's £X | same | same | same | what today's promise holds |
| grace (`graceUsed`) | grace day | same | grace night | same | grace — one covered miss a week |
| `Streak` | streak (dying: see Integrity Score, vision §4) | same | same | same | Integrity score |
| `Season` / `Sprint` | season / sprint | same | same | same | unchanged |
| `IvyCircle` | circle / the room | same | same | same | unchanged |
| `AccountabilityBuddy` | witness (spoken); "buddy" only in legacy code | same | same | same | **witness** — per-promise link (vision pass 2 §B) |
| Coach (`coachId`) | your coach | same | same | same | professional witness (internal framing only — users say "coach") |
| Forfeit destination | "goes to [charity]" — always named, always concrete | same | same | same | unchanged |

## Voice rules (from the design constitution, restated for copywriters)

- Ivy speaks serif-italic and botanical; the machine speaks mono-caps and blunt.
  Never mix in one phrase.
- Money is always concrete: "£2.33", never "your daily slice".
- On success the stake is **kept/returned** — never "donated". Donation language
  is exclusively for forfeits (and Phase 6 corporate success-donations when live).
- The vine only lies fallow, never lies — and never jeers: every miss message
  carries the comeback frame ("she's back on it today"), especially anything a
  witness sees.

## Known debt (not fixed by this doc, tracked so it isn't re-found)

- `/transformation` page copy predates the track lexicon (says "workouts" to
  all tracks) and still uses the retired tier-permission framing.
- Legacy `Streak` bonuses (`bonus7DayClaimed` etc.) are wallet-era fields —
  dead weight in the schema; remove with the Integrity Score migration.
- `ImpactStory` tier-gated media fields (photoUrl PRO+, audio ELITE+) reference
  retired tiers.

# Ivy Design Constitution — the Living Vine language

Locked 3 July 2026 from the approved direction sample (bioluminescent ivy, dark water).
Every consumer surface follows this document. When a screen can't decide, this decides.

## The one idea

**Your commitment is a living ivy.** Each kept day grows a glowing leaf. Tonight's
unkept day is a bud waiting to unfurl. A missed day is a fallen leaf — dimmed, bare,
still on the stem. The money mechanics are the ecosystem the plant lives in: keep the
vine alive or feed the forfeit. Every design choice serves this metaphor; anything
that doesn't is decoration and gets cut.

## Palette — "abyss + lumen"

One accent. Coral appears ONLY when money is at risk. No gold anywhere.

| Role | Value | Token |
|---|---|---|
| Abyss base (page bottom) | `#010507` | `--ink-900` |
| Abyss card | `#061a26` (as gradient `rgba(8,34,48,.55) → rgba(4,18,25,.78)`) | `--ink-800` / `.surface` |
| Lumen (THE accent) | `#46f0c8` | `--gold-400` (legacy name, vine value) |
| Lumen bright | `#9ffbe4` | `--gold-300` |
| Ice (primary text) | `#d7f7ef` | `--ink-50` |
| Mist (muted text) | `#6b9d94` | `--ink-400` |
| Coral (money leaving, ONLY) | `#ff7a6b` | `--ember-400` |
| Amber (attention: unarmed / awaiting action) | `#ffb03a` | inline (console states) |

Backgrounds are never flat: the page is a vertical dive (`#041219 → #02090d → #010507`)
with a cool glow at the top horizon and faint plankton motes (`.theme-vine::before`).

## Typography

- **Display / the voice**: Newsreader, *always italic*, weight 300–400. Greetings,
  organism copy, stat numerals. It speaks like a calm coach, not a dashboard.
- **Body**: Instrument Sans 400/500.
- **Machinery**: DM Mono, 8.5–10.5px, `tracking 0.2–0.3em`, uppercase — labels,
  timestamps, section kickers, mechanic states (NOT ARMED). The mono voice is how
  the *system* talks; the serif is how *Ivy* talks. Never mix them in one phrase.

## Copy voice

- Ivy (serif italic): warm, first-person, botanical. "Your ivy is three leaves strong."
- The mechanic (mono caps): blunt, consequences stated flat. "MISS TONIGHT & A LEAF FALLS · −£2.33".
- Money is always concrete (£2.33, never "your daily slice").

## Motion (the "seamless" half — required, not optional)

- `vine-breathe`: the whole plant scales 1 → 1.012, 6s ease-in-out, forever.
- `leaf-ignite`: new leaf springs in (scale .6 → 1.06 → 1, brightness flash), 900ms,
  fired on the leaf earned most recently.
- `bud-pulse`: tonight's bud opacity .55 → .95, 2.4s, while the day is unkept.
- Interactions: 150–250ms, `cubic-bezier(0.22,1,0.36,1)` (spring-ish out).
- Page-level: content fades/rises 8px on mount with staggered delays; never pops.

## Components

- **Cards** = `.surface` strata: 20px radius, deep-water gradient, 1px lumen hairline
  (`rgba(70,240,200,.09)`), blur. Primary cards get `.glass-gold` (lumen border + halo).
- **Week days** = round cells; kept = filled lumen glow, today = dashed lumen ring,
  forfeited = coral-dimmed, upcoming = faint outline.
- **The organism** (`components/living/IvyVine.tsx`) is data-truthful: it only draws
  lived days from `StakeState.week`. Never render a fake healthy plant.
- **The console layer** (the A+B blend, chosen over pure A): money mechanics speak
  like machinery *around* the living organism. HUD readouts flank the vine
  (`IVY-01 · N LEAVES` / `INTEGRITY %`); a terminal statusline states the
  consequence with a blinking cursor (`> miss tonight and a leaf falls · −£2.33 ▮`);
  the stake card is a console: state word in mono caps (ARMED lumen / NOT ARMED
  amber), an `[ARM] HOLD TO REC` key rail, the week as square lives. Serif = the
  plant speaks; mono = the machine speaks; never blended in one phrase.
- **Buttons**: primary = lumen fill, dark text. Risk actions = coral outline. Round.
- **Bottom nav**: 4 points (Home · Ivy · Circle · Impact), mono caps labels, active =
  lit dot with halo.

## Theme mechanics (how it's wired)

- `.theme-vine` in `app/globals.css` — scoped token swap over the legacy `--gold-*` /
  `--ink-*` names (same mechanism `.theme-arcade` used; arcade survives only on
  `/showcase` as a lab). Applied on every consumer + coach root.
- Fonts loaded in `app/layout.tsx` (`Newsreader` + `Instrument Sans` + `DM Mono`);
  `font-display` resolves to Newsreader inside the vine scope.
- New surfaces: build with tokens (`bg-ink-800`, `text-gold-300`…) and utility classes
  (`.surface`, `.glass-gold`, `.glow-sm-gold`) — never hex values in components.

## Not yet migrated (the queue)

1. Marketing site + pricing (biggest win: the vine becomes the hero asset)
2. Daily loop (`/daily`) — vine belongs here too, larger, with the arm ritual
3. Stake setup / onboarding polish
4. Coach dashboard
5. Kill list when migration completes: gold values in `:root`, `.theme-arcade`
   (once /showcase retired), `LivingForm` (superseded by `IvyVine`)

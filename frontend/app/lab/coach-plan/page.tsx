'use client'

/**
 * /lab/coach-plan — no-auth harness for the two coach-plan controls.
 *
 * The real screen is behind coach auth AND needs a real client, which makes
 * these effectively unreviewable before they ship. Reference only; /lab 404s in
 * production.
 */

import { useState } from 'react'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']

export default function LabCoachPlan() {
  const [floor, setFloor] = useState('10,000 steps')
  const [sessionDays, setSessionDays] = useState<string[]>(['tuesday', 'thursday'])
  const name = 'Sam'

  return (
    <div className="theme-vine min-h-screen px-4 py-8">
      <div className="mx-auto max-w-md space-y-3">
        <h1 className="font-display italic text-2xl text-ink-50 mb-4">Coach plan — floor & session days</h1>

        <div className="rounded-2xl surface p-4 space-y-2">
          <p className="text-xs font-semibold text-ink-200">The floor on a bad day</p>
          <p className="text-2xs text-ink-400 leading-relaxed">
            What still counts when {name} can&rsquo;t do the plan. Ivy offers it only
            after they&rsquo;ve said the day&rsquo;s gone wrong &mdash; never as an easy way out &mdash;
            and taking it counts as a kept day.
          </p>
          <input
            value={floor}
            onChange={(e) => setFloor(e.target.value)}
            placeholder="e.g. 10,000 steps"
            className="w-full px-3 py-2 text-sm bg-ink-900/50 border border-ink-600 rounded-xl text-ink-200 placeholder:text-ink-600 focus:outline-none focus:ring-1 focus:ring-gold-400/40 focus:border-gold-400/30 transition-colors"
          />
          <p className="text-2xs text-ink-500 leading-relaxed">
            Coming from you it holds. A floor {name} sets alone is one they can talk
            themselves out of at 9pm.
          </p>
        </div>

        <div className="rounded-2xl surface p-4 space-y-2">
          <p className="text-xs font-semibold text-ink-200">When you see {name}</p>
          <p className="text-2xs text-ink-400 leading-relaxed">
            Your usual days, in person or online. Ivy builds toward them
            (&ldquo;what do you want to show him?&rdquo;) and picks up afterwards. She treats it
            as your rhythm, not a diary &mdash; she&rsquo;ll never claim a session happened.
          </p>
          <div className="flex flex-wrap gap-1.5 pt-0.5">
            {DAYS.map((d) => {
              const on = sessionDays.includes(d)
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSessionDays(on ? sessionDays.filter((x) => x !== d) : [...sessionDays, d])}
                  className={`px-2.5 py-1.5 rounded-lg font-mono text-[8.5px] uppercase tracking-[0.16em] border transition-colors ${
                    on ? 'border-gold-400/40 bg-gold-400/10 text-gold-300' : 'border-ink-600 text-ink-500 hover:text-ink-300'
                  }`}
                >
                  {d.slice(0, 3)}
                </button>
              )
            })}
          </div>
        </div>

        <div className="rounded-2xl surface p-4">
          <p className="text-xs font-semibold text-ink-200 mb-1">Programme check-in areas</p>
          <p className="text-2xs text-ink-400 leading-relaxed">
            Define what Ivy checks in on with {name} — nutrition, sleep, stress, anything.
          </p>
        </div>
      </div>
    </div>
  )
}

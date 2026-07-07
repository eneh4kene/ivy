'use client'

/**
 * /coach/settings — Coach profile & preferences.
 *
 * Wired to real coachApi: getProfile (load) + updateProfile (save).
 * DEFAULT_PROFILE is empty-field defaults for an unset profile, not seed data.
 * Feature toggles: weekly digest, ponder sessions, white-label.
 */

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Save, Check, Eye, EyeOff, ChevronDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { coachApi, usersApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'

// ─── Toggle switch ─────────────────────────────────────────────────────────────

function Toggle({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className={`
        relative w-11 h-6 rounded-full border-2 transition-all duration-200 shrink-0
        ${on ? 'bg-gold-400 border-gold-400' : 'bg-transparent border-ink-600 hover:border-ink-400'}
      `}
    >
      <span
        className={`
          absolute top-0.5 w-4 h-4 rounded-full shadow-sm transition-transform duration-200
          ${on ? 'translate-x-5 bg-ink-900' : 'translate-x-0.5 bg-ink-400'}
        `}
      />
      {label && <span className="sr-only">{label}</span>}
    </button>
  )
}

// ─── Field wrappers ───────────────────────────────────────────────────────────

const inputClass = `
  w-full px-3 py-2.5 text-sm
  bg-ink-900/50 border border-ink-600 rounded-xl
  text-ink-200 placeholder:text-ink-600
  focus:outline-none focus:ring-1 focus:ring-gold-400/40 focus:border-gold-400/30
  transition-colors
`
const labelClass = 'text-xs font-semibold text-ink-200 block mb-1.5'

// ─── Section card ─────────────────────────────────────────────────────────────

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl surface p-5 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-ink-50">{title}</h2>
        {subtitle && <p className="text-2xs text-ink-400 mt-0.5 leading-relaxed">{subtitle}</p>}
      </div>
      {children}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const DISCIPLINES = [
  { id: 'fitness',   label: 'Fitness / PT' },
  { id: 'wellness',  label: 'Wellness' },
  { id: 'nutrition', label: 'Nutrition' },
  { id: 'mindset',   label: 'Mindset / Performance' },
  { id: 'physio',    label: 'Physio / Rehab' },
  { id: 'other',     label: 'Other' },
] as const

const DEFAULT_PROFILE = {
  discipline:          '',
  programmeName:       '',
  coachingStyle:       '',
  programmeNotes:      '',
  whitelabelEnabled:   false,
  brandName:           '',
  brandLogoUrl:        '',
  alertOnMissedCalls:  3 as 2 | 3 | 5,
  weeklyDigestEnabled: true,
  ponderCallEnabled:   false,
  ponderCallDay:       1,
  ponderCallTime:      '09:00',
  ponderCallFrequency: 'fortnightly' as 'weekly' | 'fortnightly',
}

export default function CoachSettingsPage() {
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()
  const [phone, setPhone] = useState('')
  const [profile, setProfile] = useState(DEFAULT_PROFILE)
  const [loaded, setLoaded] = useState(false)
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    coachApi.getProfile().then((p) => {
      if (!p) return
      setProfile({
        discipline:          (p as any).discipline ?? '',
        programmeName:       p.programmeName ?? '',
        coachingStyle:       p.coachingStyle ?? '',
        programmeNotes:      p.programmeNotes ?? '',
        whitelabelEnabled:   p.whitelabelEnabled ?? false,
        brandName:           p.brandName ?? '',
        brandLogoUrl:        p.brandLogoUrl ?? '',
        alertOnMissedCalls:  (([2, 3, 5].includes(p.alertOnMissedCalls ?? 3) ? p.alertOnMissedCalls : 3) as 2 | 3 | 5),
        weeklyDigestEnabled: p.weeklyDigestEnabled ?? true,
        ponderCallEnabled:   p.ponderCallEnabled ?? false,
        ponderCallDay:       p.ponderCallDay ?? 1,
        ponderCallTime:      p.ponderCallTime ?? '09:00',
        ponderCallFrequency: (p.ponderCallFrequency === 'weekly' ? 'weekly' : 'fortnightly') as 'weekly' | 'fortnightly',
      })
      setLoaded(true)
    }).catch(() => setLoaded(true))
  }, [])

  useEffect(() => { if (user?.phone) setPhone(user.phone) }, [user?.phone])

  const handleSave = async () => {
    if (!profile.programmeName.trim()) {
      setError('Programme name is required.')
      return
    }
    setError('')
    setSaving(true)
    try {
      await coachApi.updateProfile({
        discipline:          profile.discipline || undefined,
        programmeName:       profile.programmeName,
        coachingStyle:       profile.coachingStyle,
        programmeNotes:      profile.programmeNotes,
        whitelabelEnabled:   profile.whitelabelEnabled,
        brandName:           profile.brandName,
        brandLogoUrl:        profile.brandLogoUrl,
        alertOnMissedCalls:  profile.alertOnMissedCalls,
        weeklyDigestEnabled: profile.weeklyDigestEnabled,
        ponderCallEnabled:   profile.ponderCallEnabled,
        ponderCallDay:       profile.ponderCallDay,
        ponderCallTime:      profile.ponderCallTime,
        ponderCallFrequency: profile.ponderCallFrequency,
      })
      // Phone powers the ponder calls + the welcome call — save if provided.
      if (phone.trim() && phone.trim() !== user?.phone) {
        await usersApi.updateProfile({ phone: phone.trim() } as any).catch(() => {})
      }
      // First completed setup = coach onboarding done → the partner welcome
      // call schedules itself server-side. Route into the console.
      if (user && !user.isOnboarded) {
        await usersApi.markAsOnboarded().catch(() => {})
        await fetchUser().catch(() => {})
        router.replace('/coach')
        return
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save settings.')
    } finally {
      setSaving(false)
    }
  }

  const p = profile
  const set = (patch: Partial<typeof profile>) => setProfile({ ...profile, ...patch })

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  return (
    <div className="min-h-dvh mesh-bg-subtle pb-safe-b">
      <div className="max-w-lg mx-auto px-4">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 pt-safe-t pt-6 pb-5">
          <Link href="/coach">
            <button className="w-9 h-9 rounded-xl bg-ink-700/80 border border-ink-600 flex items-center justify-center hover:bg-ink-700 transition-colors" aria-label="Back">
              <ArrowLeft className="w-4 h-4 text-ink-200" />
            </button>
          </Link>
          <div>
            <h1 className="font-display text-xl font-semibold text-ink-50">Coach settings</h1>
            <p className="text-2xs text-ink-400">How Ivy shows up for your clients</p>
          </div>
        </div>

        <div className="space-y-4 pb-6">

          {/* ── Programme ── */}
          <Section
            title="Your programme"
            subtitle="This shapes how Ivy introduces you and runs calls with your clients."
          >
            <div>
              <label className={labelClass}>Your discipline</label>
              <div className="flex flex-wrap gap-2">
                {DISCIPLINES.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => set({ discipline: d.id })}
                    className={`px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${
                      p.discipline === d.id
                        ? 'border-gold-400 bg-gold-400/15 text-gold-200'
                        : 'border-ink-600 text-ink-300 hover:border-ink-500'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-2xs text-ink-400 mt-1.5">How clients discover you, and how Ivy introduces you — &ldquo;your {p.discipline || 'fitness'} coach&rdquo;.</p>
            </div>

            <div>
              <label className={labelClass}>
                Your phone{' '}
                <span className="text-ink-400 font-normal">— for ponder calls</span>
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+44 7700 900000"
                className={inputClass}
              />
              <p className="text-2xs text-ink-400 mt-1.5">Ivy rings you here — the welcome call and your biweekly ponder sessions.</p>
            </div>

            <div>
              <label className={labelClass}>Programme name *</label>
              <input
                value={p.programmeName}
                onChange={(e) => set({ programmeName: e.target.value })}
                placeholder="e.g. 12-Week Fat Loss, Marathon Prep, Strength Foundation"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>
                Coaching style{' '}
                <span className="text-ink-400 font-normal">— optional</span>
              </label>
              <input
                value={p.coachingStyle}
                onChange={(e) => set({ coachingStyle: e.target.value })}
                placeholder="e.g. direct and data-driven, nurturing and long-term"
                className={inputClass}
              />
              <p className="text-2xs text-ink-400 mt-1.5">Ivy matches this register in all client calls.</p>
            </div>

            <div>
              <label className={labelClass}>
                General client notes{' '}
                <span className="text-ink-400 font-normal">— optional</span>
              </label>
              <textarea
                value={p.programmeNotes}
                onChange={(e) => set({ programmeNotes: e.target.value })}
                rows={3}
                placeholder="Anything Ivy should know about all your clients (e.g. 'All clients are training for obstacle races — celebrate mental toughness over aesthetics')"
                className={`${inputClass} resize-none`}
              />
            </div>
          </Section>

          {/* ── Alerts ── */}
          <Section
            title="Alerts"
            subtitle="When to flag client attention to you."
          >
            <div>
              <label className={labelClass}>Alert me when a client misses this many calls in a row</label>
              <div className="flex gap-2">
                {([2, 3, 5] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => set({ alertOnMissedCalls: n })}
                    className={`
                      flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all
                      ${p.alertOnMissedCalls === n
                        ? 'bg-gold-400 text-ink-900 border-gold-400'
                        : 'bg-transparent text-ink-400 border-ink-600 hover:border-ink-400 hover:text-ink-200'}
                    `}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Toggle on={p.weeklyDigestEnabled} onChange={(v) => set({ weeklyDigestEnabled: v })} label="Weekly client digest" />
              <div className="flex-1">
                <p className="text-sm text-ink-200 font-medium">Weekly client digest</p>
                <p className="text-2xs text-ink-400">Email every Monday with each client's week at a glance</p>
              </div>
            </div>
          </Section>

          {/* ── Ponder sessions ── */}
          <Section
            title="Coaching ponder sessions"
            subtitle="Ivy calls you on a schedule to discuss your clients — what's working, what to adjust, how to improve each programme."
          >
            <div className="flex items-center gap-3">
              <Toggle on={p.ponderCallEnabled} onChange={(v) => set({ ponderCallEnabled: v })} label="Ponder sessions" />
              <p className="text-sm text-ink-200 font-medium">
                {p.ponderCallEnabled ? 'Ponder sessions on' : 'Ponder sessions off'}
              </p>
            </div>

            {p.ponderCallEnabled && (
              <div className="space-y-4 pt-1 animate-fade-in">
                <div>
                  <label className={labelClass}>Preferred day</label>
                  <div className="flex gap-1.5 flex-wrap">
                    {DAYS.map((d, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => set({ ponderCallDay: i })}
                        className={`
                          px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all
                          ${p.ponderCallDay === i
                            ? 'bg-gold-400 text-ink-900 border-gold-400'
                            : 'bg-transparent text-ink-400 border-ink-600 hover:border-ink-400 hover:text-ink-200'}
                        `}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Frequency</label>
                  <div className="flex gap-2">
                    {([['weekly', 'Weekly'], ['fortnightly', 'Every two weeks']] as const).map(([val, lbl]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => set({ ponderCallFrequency: val })}
                        className={`
                          flex-1 py-2.5 rounded-xl text-sm font-semibold border transition-all
                          ${p.ponderCallFrequency === val
                            ? 'bg-gold-400 text-ink-900 border-gold-400'
                            : 'bg-transparent text-ink-400 border-ink-600 hover:border-ink-400 hover:text-ink-200'}
                        `}
                      >
                        {lbl}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Preferred time</label>
                  <input
                    type="time"
                    value={p.ponderCallTime}
                    onChange={(e) => set({ ponderCallTime: e.target.value })}
                    className={inputClass}
                  />
                  <p className="text-2xs text-ink-400 mt-1.5">
                    Ivy will call you at approximately this time{' '}
                    {p.ponderCallFrequency === 'fortnightly' ? 'every two weeks' : 'every week'}.
                  </p>
                </div>
              </div>
            )}
          </Section>

          {/* ── White-label ── */}
          <Section
            title="My branding"
            subtitle={'When enabled, your clients see your brand name instead of Ivy in emails and the app. "Powered by Ivy" attribution stays on all communications.'}
          >
            <div className="flex items-center gap-3">
              <Toggle on={p.whitelabelEnabled} onChange={(v) => set({ whitelabelEnabled: v })} label="Use my branding" />
              <div className="flex-1">
                <p className="text-sm text-ink-200 font-medium">
                  {p.whitelabelEnabled ? 'Using my branding' : 'Using Ivy branding'}
                </p>
              </div>
              {p.whitelabelEnabled
                ? <Eye className="w-4 h-4 text-gold-400 shrink-0" />
                : <EyeOff className="w-4 h-4 text-ink-400 shrink-0" />}
            </div>

            {p.whitelabelEnabled && (
              <div className="space-y-3 pt-1 animate-fade-in">
                <div>
                  <label className={labelClass}>Brand name *</label>
                  <input
                    value={p.brandName}
                    onChange={(e) => set({ brandName: e.target.value })}
                    placeholder="e.g. Marcus Fitness, Coach Sarah, FitLife Coaching"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Logo URL{' '}
                    <span className="text-ink-400 font-normal">— optional</span>
                  </label>
                  <input
                    value={p.brandLogoUrl}
                    onChange={(e) => set({ brandLogoUrl: e.target.value })}
                    placeholder="https://your-logo.com/logo.png"
                    className={inputClass}
                  />
                  <p className="text-2xs text-ink-400 mt-1.5">36px height recommended.</p>
                </div>

                {p.brandName && (
                  <div className="p-3 rounded-xl bg-ink-900/50 border border-ink-600">
                    <p className="text-2xs text-ink-400 uppercase tracking-wider mb-2">Email preview</p>
                    <div className="flex items-center gap-2">
                      {p.brandLogoUrl
                        ? <img src={p.brandLogoUrl} alt={p.brandName} className="h-6 object-contain" />
                        : <span className="text-sm font-bold font-display text-ink-50">{p.brandName}</span>}
                    </div>
                    <p className="text-2xs text-ink-400 mt-2">Powered by Ivy · Privacy · Terms</p>
                  </div>
                )}
              </div>
            )}
          </Section>

          {/* ── Error / Save ── */}
          {error && <p className="text-xs text-ember-400 px-1">{error}</p>}

          <button
            onClick={handleSave}
            className="
              w-full flex items-center justify-center gap-2 py-4 rounded-2xl
              bg-gold-400 text-ink-900 font-semibold text-sm
              hover:bg-gold-300 active:scale-[0.98]
              transition-all duration-150
            "
          >
            {saved
              ? <><Check className="w-4 h-4" /> Saved</>
              : saving
              ? <><span className="w-4 h-4 rounded-full border-2 border-ink-900/30 border-t-ink-900 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save settings</>}
          </button>

        </div>
      </div>
    </div>
  )
}

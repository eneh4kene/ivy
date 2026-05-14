'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'
import { isSuperAdmin } from '@/lib/permissions'
import { gameSuggestionsApi, type GameSuggestion } from '@/lib/api'
import { Plus, Pencil, Trash2, Eye, EyeOff, Loader2, CheckCircle2, X } from 'lucide-react'

const TRACKS = ['fitness', 'focus', 'sleep', 'balance']
const TEMPLATE_TYPES = ['relay', 'points_race', 'collective', 'custom']
const COMMON_TAGS = ['seasonal', 'social', 'outdoor', 'indoor', 'reading', 'creative',
  'mindfulness', 'competitive', 'team', 'christmas', 'new-year', 'summer', 'ramadan']

const TEMPLATE_LABELS: Record<string, string> = {
  relay: '🏃 Relay', points_race: '🏆 Points race',
  collective: '🤝 Group challenge', custom: '✨ Custom',
}

export default function SuggestionsAdminPage() {
  const user = useAuthStore((s) => s.user)
  const [suggestions, setSuggestions] = useState<GameSuggestion[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<GameSuggestion | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const blank = (): Omit<GameSuggestion, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'> => ({
    title: '', description: '', templateType: 'custom', ivyInstruction: '',
    tracks: [], tags: [], published: false,
  })
  const [form, setForm] = useState(blank())

  useEffect(() => {
    if (!isSuperAdmin(user)) return
    gameSuggestionsApi.listAll()
      .then(setSuggestions)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  if (!isSuperAdmin(user)) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p className="font-medium">Superadmin access required.</p>
      </div>
    )
  }

  const openCreate = () => { setForm(blank()); setEditing(null); setError(''); setShowForm(true) }
  const openEdit = (s: GameSuggestion) => {
    setForm({ title: s.title, description: s.description, templateType: s.templateType,
      ivyInstruction: s.ivyInstruction, tracks: s.tracks, tags: s.tags, published: s.published })
    setEditing(s); setError(''); setShowForm(true)
  }

  const handleSave = async () => {
    if (!form.title.trim() || !form.ivyInstruction.trim()) {
      setError('Title and Ivy instruction are required.'); return
    }
    setSaving(true); setError('')
    try {
      if (editing) {
        const updated = await gameSuggestionsApi.update(editing.id, form)
        setSuggestions((prev) => prev.map((s) => s.id === editing.id ? updated : s))
      } else {
        const created = await gameSuggestionsApi.create(form)
        setSuggestions((prev) => [created, ...prev])
      }
      setShowForm(false)
    } catch (e: any) {
      setError(e.response?.data?.error ?? e.message ?? 'Save failed')
    } finally { setSaving(false) }
  }

  const handleTogglePublish = async (s: GameSuggestion) => {
    const updated = await gameSuggestionsApi.update(s.id, { published: !s.published })
    setSuggestions((prev) => prev.map((x) => x.id === s.id ? updated : x))
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this suggestion permanently?')) return
    await gameSuggestionsApi.delete(id)
    setSuggestions((prev) => prev.filter((s) => s.id !== id))
  }

  const toggleArrayItem = (arr: string[], item: string) =>
    arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item]

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Game Suggestions Library</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Global pool of game ideas circles can adopt. Published suggestions appear in the create modal.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" /> Add suggestion
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
      ) : suggestions.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <p className="font-medium mb-1">No suggestions yet</p>
          <p className="text-sm">Add one to start building the library.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {suggestions.map((s) => (
            <div key={s.id} className={`p-4 rounded-xl border transition-colors ${s.published ? 'border-border bg-card' : 'border-dashed border-border bg-muted/20'}`}>
              <div className="flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-semibold">{s.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                      {TEMPLATE_LABELS[s.templateType] ?? s.templateType}
                    </span>
                    {!s.published && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">Draft</span>
                    )}
                    {s.usageCount > 0 && (
                      <span className="text-[10px] text-muted-foreground">Used {s.usageCount}×</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{s.description}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {s.tracks.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{t}</span>
                    ))}
                    {s.tags.map((t) => (
                      <span key={t} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">{t}</span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => handleTogglePublish(s)} title={s.published ? 'Unpublish' : 'Publish'}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    {s.published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                  <button onClick={() => openEdit(s)}
                    className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(s.id)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
          <div className="w-full max-w-2xl bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="font-semibold">{editing ? 'Edit suggestion' : 'New suggestion'}</h2>
              <button onClick={() => setShowForm(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Title + description */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1.5 block">Title</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. Café Book Club" autoFocus
                    className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-medium mb-1.5 block">One-line description</label>
                  <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Shown on the card in the create modal"
                    className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>

              {/* Template type */}
              <div>
                <label className="text-xs font-medium mb-1.5 block">Game type</label>
                <div className="flex flex-wrap gap-2">
                  {TEMPLATE_TYPES.map((t) => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, templateType: t })}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        form.templateType === t ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-border/80'
                      }`}>
                      {TEMPLATE_LABELS[t]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ivy instruction */}
              <div>
                <label className="text-xs font-medium mb-1 block">Ivy's instruction</label>
                <p className="text-xs text-muted-foreground mb-2">
                  This pre-fills the circle's instruction field. They can edit it. Write it as if you're briefing Ivy directly.
                </p>
                <textarea value={form.ivyInstruction} onChange={(e) => setForm({ ...form, ivyInstruction: e.target.value })}
                  rows={6} placeholder="When someone in the focus circle reads for 30 minutes in a café and logs it, celebrate it as a 'scene change win'..."
                  className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </div>

              {/* Tracks */}
              <div>
                <label className="text-xs font-medium mb-1.5 block">Tracks <span className="text-muted-foreground font-normal">(empty = all tracks)</span></label>
                <div className="flex gap-2 flex-wrap">
                  {TRACKS.map((t) => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, tracks: toggleArrayItem(form.tracks, t) })}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                        form.tracks.includes(t) ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-border/80'
                      }`}>
                      {form.tracks.includes(t) && <CheckCircle2 className="w-3 h-3" />}
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tags */}
              <div>
                <label className="text-xs font-medium mb-1.5 block">Tags</label>
                <div className="flex gap-2 flex-wrap">
                  {COMMON_TAGS.map((t) => (
                    <button key={t} type="button"
                      onClick={() => setForm({ ...form, tags: toggleArrayItem(form.tags, t) })}
                      className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                        form.tags.includes(t) ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:border-border/80'
                      }`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* Published toggle */}
              <div className="flex items-center gap-3">
                <button type="button"
                  onClick={() => setForm({ ...form, published: !form.published })}
                  className={`relative w-10 h-5 rounded-full transition-colors ${form.published ? 'bg-primary' : 'bg-muted border border-border'}`}>
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${form.published ? 'translate-x-5' : ''}`} />
                </button>
                <span className="text-sm">{form.published ? 'Published — visible to circles' : 'Draft — not visible yet'}</span>
              </div>

              {error && <p className="text-xs text-destructive">{error}</p>}

              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors">
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-40 transition-opacity">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {editing ? 'Save changes' : 'Create suggestion'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

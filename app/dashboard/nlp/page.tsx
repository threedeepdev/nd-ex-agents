'use client'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

type Show = {
  id: string
  show_date: string
  artist_name: string
  genre?: string
  description?: string
  ticket_price?: number
}

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function getMonday(offsetWeeks = 0): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff + offsetWeeks * 7)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function weekLabel(monday: string): string {
  const d = new Date(monday + 'T12:00:00Z')
  const end = new Date(monday + 'T12:00:00Z')
  end.setUTCDate(end.getUTCDate() + 6)
  const startLabel = `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`
  const endLabel = `${MONTH_NAMES[end.getUTCMonth()]} ${end.getUTCDate()}`
  return `${startLabel} – ${endLabel}`
}

function fmtShowDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  return `${DAY_NAMES[d.getUTCDay()]} ${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`
}

export default function NLPPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const thisMonday = getMonday(0)
  const nextMonday = getMonday(1)

  const [thisWeekShows, setThisWeekShows] = useState<Show[]>([])
  const [nextWeekShows, setNextWeekShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addDefaultDate, setAddDefaultDate] = useState<string | null>(null)
  const [posterKeys, setPosterKeys] = useState({ this: 0, next: 0 })
  const [posterModal, setPosterModal] = useState<{ week: string; label: string } | null>(null)
  const [syncing, setSyncing] = useState(false)
  const [syncResult, setSyncResult] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  const loadShows = () => {
    setLoading(true)
    Promise.all([
      fetch(`/api/nlp/shows?week=${thisMonday}`).then(r => r.json()),
      fetch(`/api/nlp/shows?week=${nextMonday}`).then(r => r.json()),
    ]).then(([thisData, nextData]) => {
      setThisWeekShows(thisData.shows || [])
      setNextWeekShows(nextData.shows || [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { loadShows() }, [])

  const syncFromWeb = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/nlp/scrape')
      const data = await res.json()
      if (data.error) { setSyncResult(data.error); setSyncing(false); return }
      const { shows: scraped, count } = data
      if (count === 0) {
        setSyncResult('No upcoming shows found online.')
      } else {
        let saved = 0
        for (const s of scraped) {
          const r = await fetch('/api/nlp/shows', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ showDate: s.showDate, artistName: s.artistName, genre: s.genre }),
          })
          if (r.ok) saved++
        }
        loadShows()
        setPosterKeys(k => ({ this: k.this + 1, next: k.next + 1 }))
        setSyncResult(`Found ${count} shows online, saved ${saved}.`)
      }
    } catch {
      setSyncResult('Sync failed — check connection.')
    }
    setSyncing(false)
  }

  const deleteShow = async (id: string, week: 'this' | 'next') => {
    await fetch(`/api/nlp/shows?id=${id}`, { method: 'DELETE' })
    if (week === 'this') setThisWeekShows(s => s.filter(x => x.id !== id))
    else setNextWeekShows(s => s.filter(x => x.id !== id))
    setPosterKeys(k => week === 'this' ? { ...k, this: k.this + 1 } : { ...k, next: k.next + 1 })
  }

  if (status === 'loading') return null

  const s = {
    shell: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' } as React.CSSProperties,
    sidebar: { background: '#080808', padding: 0, display: 'flex', flexDirection: 'column' as const },
    wordmark: { fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, color: 'white', letterSpacing: '-0.02em' },
    wordmarkSpan: { color: '#c0392b' },
    navItem: (active: boolean) => ({ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', fontSize: '13px', color: active ? 'white' : 'rgba(255,255,255,0.45)', background: active ? 'rgba(255,255,255,0.08)' : 'transparent', cursor: 'pointer', marginBottom: '2px', fontWeight: active ? 500 : 400 }),
  }

  const allWeekDays = [
    ...Array.from({ length: 7 }, (_, i) => addDays(thisMonday, i)),
    ...Array.from({ length: 7 }, (_, i) => addDays(nextMonday, i)),
  ]

  return (
    <div className="wine-shell" style={s.shell}>
      {/* Mobile header */}
      <div className="wine-mobile-header" style={{ display: 'none', gridColumn: '1 / -1', background: '#080808', padding: '14px 20px', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={s.wordmark}>nd<span style={s.wordmarkSpan}>-ex</span></div>
        <button onClick={() => router.push('/dashboard')} style={{ fontSize: '12px', color: 'rgba(255,255,255,0.4)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>← Home</button>
      </div>

      {/* Sidebar */}
      <div className="wine-sidebar" style={s.sidebar}>
        <div style={{ padding: '24px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={s.wordmark}>nd<span style={s.wordmarkSpan}>-ex</span></div>
          <div style={{ marginTop: '14px', fontSize: '13px', color: '#c0392b', letterSpacing: '0.1em', textTransform: 'uppercase' as const }}>Nikki Lopez</div>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.3)', marginTop: '2px' }}>Concert Venue</div>
        </div>
        <div style={{ padding: '16px 12px', flex: 1 }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.25)', padding: '4px 8px', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: '4px' }}>Schedule</div>
          <div style={s.navItem(true)}>🎵 Upcoming shows</div>
        </div>
        <div style={{ padding: '16px 12px', borderTop: '0.5px solid rgba(255,255,255,0.07)' }}>
          <div style={{ ...s.navItem(false) }} onClick={() => router.push('/dashboard')}>← Dashboard</div>
        </div>
      </div>

      {/* Main */}
      <div style={{ background: '#f9f6f1', display: 'flex', flexDirection: 'column', maxHeight: '100vh', overflow: 'hidden' }}>
        {/* Topbar */}
        <div style={{ padding: '20px 28px', borderBottom: '0.5px solid #e8e0d8', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 400, color: '#1a1210', margin: 0 }}>
            Upcoming Shows
          </h1>
          <div className="nlp-topbar-actions" style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={syncFromWeb}
              disabled={syncing}
              style={{ padding: '9px 14px', background: 'white', color: '#555', border: '0.5px solid #e8e0d8', borderRadius: '10px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: syncing ? 'default' : 'pointer' }}
            >
              {syncing ? 'Syncing...' : '↻ Sync web'}
            </button>
            <button
              onClick={() => { setAddDefaultDate(null); setShowAddModal(true) }}
              style={{ padding: '9px 18px', background: '#c0392b', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', fontWeight: 500 }}
            >
              + Add show
            </button>
          </div>
        </div>

        {/* Sync banner */}
        {syncResult && (
          <div style={{ padding: '10px 28px', background: syncResult.includes('failed') || syncResult.includes('not set') ? '#fff0f0' : '#f0faf5', borderBottom: '0.5px solid #e8e0d8', fontSize: '13px', color: syncResult.includes('failed') || syncResult.includes('not set') ? '#c0392b' : '#0F6E56', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
            {syncResult}
            <button onClick={() => setSyncResult(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#aaa', fontSize: '16px' }}>×</button>
          </div>
        )}

        {/* Content */}
        <div className="nlp-content" style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', gap: '24px' }}>
          {/* Show lists */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '28px', minWidth: 0 }}>
            <WeekSection
              label="This Week"
              dateRange={weekLabel(thisMonday)}
              shows={thisWeekShows}
              loading={loading}
              onDelete={id => deleteShow(id, 'this')}
              onAdd={() => { setAddDefaultDate(thisMonday); setShowAddModal(true) }}
            />
            <WeekSection
              label="Next Week"
              dateRange={weekLabel(nextMonday)}
              shows={nextWeekShows}
              loading={loading}
              onDelete={id => deleteShow(id, 'next')}
              onAdd={() => { setAddDefaultDate(nextMonday); setShowAddModal(true) }}
            />
          </div>

          {/* Posters */}
          <div className="nlp-poster-panel" style={{ width: '240px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <PosterCard label="This Week" week={thisMonday} posterKey={posterKeys.this} onRefresh={() => setPosterKeys(k => ({ ...k, this: k.this + 1 }))} onTap={() => setPosterModal({ week: thisMonday, label: 'This Week' })} />
            <PosterCard label="Next Week" week={nextMonday} posterKey={posterKeys.next} onRefresh={() => setPosterKeys(k => ({ ...k, next: k.next + 1 }))} onTap={() => setPosterModal({ week: nextMonday, label: 'Next Week' })} />
          </div>
        </div>
      </div>

      {posterModal && (
        <PosterModal week={posterModal.week} label={posterModal.label} onClose={() => setPosterModal(null)} />
      )}

      {showAddModal && (
        <AddShowModal
          defaultDate={addDefaultDate || thisMonday}
          allWeekDays={allWeekDays}
          onClose={() => { setShowAddModal(false); setAddDefaultDate(null) }}
          onAdd={(show) => {
            const isNext = show.show_date >= nextMonday
            if (isNext) setNextWeekShows(s => [...s, show].sort((a, b) => a.show_date.localeCompare(b.show_date)))
            else setThisWeekShows(s => [...s, show].sort((a, b) => a.show_date.localeCompare(b.show_date)))
            setPosterKeys(k => isNext ? { ...k, next: k.next + 1 } : { ...k, this: k.this + 1 })
            setShowAddModal(false)
            setAddDefaultDate(null)
          }}
        />
      )}
    </div>
  )
}

function WeekSection({ label, dateRange, shows, loading, onDelete, onAdd }: {
  label: string
  dateRange: string
  shows: Show[]
  loading: boolean
  onDelete: (id: string) => void
  onAdd: () => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', marginBottom: '10px' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '18px', fontWeight: 400, color: '#1a1210' }}>{label}</div>
        <div style={{ fontSize: '12px', color: '#aaa' }}>{dateRange}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        {loading ? (
          <div style={{ fontSize: '13px', color: '#bbb', padding: '12px 0' }}>Loading...</div>
        ) : shows.length === 0 ? (
          <div style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '10px', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#ccc' }}>No shows scheduled</span>
            <button onClick={onAdd} style={{ fontSize: '12px', color: '#c0392b', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ Add</button>
          </div>
        ) : shows.map(show => (
          <div key={show.id} style={{ background: 'white', border: '0.5px solid #d4a0a0', borderLeft: '3px solid #c0392b', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ fontSize: '12px', color: '#888', minWidth: '88px', flexShrink: 0 }}>{fmtShowDate(show.show_date)}</div>
            <div style={{ width: '0.5px', height: '28px', background: '#f0e8e0', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1210' }}>{show.artist_name}</div>
              {show.genre && <div style={{ fontSize: '11px', color: '#c0392b', marginTop: '2px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{show.genre}</div>}
              {show.description && <div style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{show.description}</div>}
            </div>
            <button
              onClick={() => onDelete(show.id)}
              style={{ background: '#fff0f0', border: '0.5px solid #f5c6c6', borderRadius: '6px', fontSize: '12px', color: '#c0392b', cursor: 'pointer', padding: '4px 10px', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function PosterCard({ label, week, posterKey, onRefresh, onTap }: { label: string; week: string; posterKey: number; onRefresh: () => void; onTap: () => void }) {
  const posterUrl = `/api/nlp/poster?week=${week}`
  return (
    <div style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '12px', overflow: 'hidden' }}>
      <div style={{ padding: '10px 14px', borderBottom: '0.5px solid #f0e8e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '11px', fontWeight: 500, color: '#555' }}>{label}</span>
        <button onClick={onRefresh} style={{ fontSize: '13px', color: '#bbb', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }} title="Refresh">↺</button>
      </div>
      <div onClick={onTap} style={{ cursor: 'pointer', position: 'relative' }}>
        <img key={posterKey} src={posterUrl} alt={`${label} poster`} style={{ width: '100%', display: 'block' }} />
        <div style={{ position: 'absolute', bottom: '8px', left: 0, right: 0, textAlign: 'center', fontSize: '10px', color: 'rgba(255,255,255,0.6)', fontFamily: 'DM Sans, sans-serif', pointerEvents: 'none' }}>
          Tap to save
        </div>
      </div>
    </div>
  )
}

function PosterModal({ week, label, onClose }: { week: string; label: string; onClose: () => void }) {
  const posterUrl = `/api/nlp/poster?week=${week}`

  const share = async () => {
    try {
      const res = await fetch(posterUrl)
      const blob = await res.blob()
      const file = new File([blob], `nlp-${week}.png`, { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Nikki Lopez — ${label}` })
        return
      }
    } catch { /* fall through */ }
    // fallback: open in new tab so user can long-press
    window.open(posterUrl, '_blank')
  }

  return (
    <div
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}
    >
      <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', maxWidth: '500px', width: '100%' }}>
        <img src={posterUrl} alt={`${label} poster`} style={{ width: '100%', borderRadius: '8px', display: 'block' }} />
        <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
          <button
            onClick={share}
            style={{ flex: 1, padding: '13px', background: '#c0392b', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: 'pointer' }}
          >
            Save / Share
          </button>
          <button
            onClick={onClose}
            style={{ padding: '13px 18px', background: 'rgba(255,255,255,0.08)', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer' }}
          >
            Close
          </button>
        </div>
        <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.3)', fontFamily: 'DM Sans, sans-serif', textAlign: 'center' }}>
          On iPhone: tap Save / Share → Save Image
        </div>
      </div>
    </div>
  )
}

function AddShowModal({ defaultDate, allWeekDays, onClose, onAdd }: {
  defaultDate: string
  allWeekDays: string[]
  onClose: () => void
  onAdd: (s: Show) => void
}) {
  const [form, setForm] = useState({ showDate: defaultDate, artistName: '', genre: '', description: '', ticketPrice: '' })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.artistName) return
    setSaving(true)
    const res = await fetch('/api/nlp/shows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        showDate: form.showDate,
        artistName: form.artistName,
        genre: form.genre || undefined,
        description: form.description || undefined,
        ticketPrice: form.ticketPrice ? parseFloat(form.ticketPrice) : undefined,
      }),
    })
    const show = await res.json()
    onAdd({ ...show, show_date: show.showDate ?? form.showDate, artist_name: show.artistName ?? form.artistName })
    setSaving(false)
  }

  const inp: React.CSSProperties = { width: '100%', border: '0.5px solid #e8e0d8', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', color: '#1a1210', background: '#fafaf8', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: '11px', color: '#888', marginBottom: '4px', display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '420px', maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 400, margin: 0 }}>Add a show</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#aaa' }}>×</button>
        </div>

        <label style={lbl}>Date</label>
        <select value={form.showDate} onChange={e => setForm(f => ({ ...f, showDate: e.target.value }))} style={{ ...inp, cursor: 'pointer' }}>
          {allWeekDays.map(d => {
            const dt = new Date(d + 'T12:00:00Z')
            const label = dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })
            return <option key={d} value={d}>{label}</option>
          })}
        </select>

        <label style={lbl}>Artist / Act *</label>
        <input style={inp} placeholder="e.g. The Midnight" value={form.artistName} onChange={e => setForm(f => ({ ...f, artistName: e.target.value }))} autoFocus />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={lbl}>Genre</label>
            <input style={inp} placeholder="Jazz, Rock..." value={form.genre} onChange={e => setForm(f => ({ ...f, genre: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Ticket price ($)</label>
            <input style={inp} placeholder="25" type="number" min="0" value={form.ticketPrice} onChange={e => setForm(f => ({ ...f, ticketPrice: e.target.value }))} />
          </div>
        </div>

        <label style={lbl}>Description</label>
        <textarea style={{ ...inp, height: '60px', resize: 'none' as const }} placeholder="Short description..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

        <button
          onClick={submit}
          disabled={!form.artistName || saving}
          style={{ width: '100%', padding: '12px', background: form.artistName ? '#c0392b' : '#e8e0d8', color: form.artistName ? 'white' : '#aaa', border: 'none', borderRadius: '10px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: form.artistName ? 'pointer' : 'default' }}
        >
          {saving ? 'Saving...' : 'Add show'}
        </button>
      </div>
    </div>
  )
}

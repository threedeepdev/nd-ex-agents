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

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getMonday(offset = 0): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? -6 : 1 - day
  d.setDate(d.getDate() + diff + offset * 7)
  return d.toISOString().split('T')[0]
}

function addDays(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00Z')
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().split('T')[0]
}

function fmtDay(dateStr: string): { day: string; num: number; month: string } {
  const d = new Date(dateStr + 'T12:00:00Z')
  return {
    day: DAYS[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1],
    num: d.getUTCDate(),
    month: MONTH_NAMES[d.getUTCMonth()],
  }
}

function weekLabel(monday: string): string {
  const d = new Date(monday + 'T12:00:00Z')
  const end = new Date(monday + 'T12:00:00Z')
  end.setUTCDate(end.getUTCDate() + 6)
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()} – ${MONTH_NAMES[end.getUTCMonth()]} ${end.getUTCDate()}, ${d.getUTCFullYear()}`
}

export default function NLPPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [weekOffset, setWeekOffset] = useState(0)
  const [shows, setShows] = useState<Show[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [addDate, setAddDate] = useState<string | null>(null)
  const [posterKey, setPosterKey] = useState(0)

  const monday = getMonday(weekOffset)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(monday, i))
  const posterUrl = `/api/nlp/poster?week=${monday}`

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/nlp/shows?week=${monday}`)
      .then(r => r.json())
      .then(d => { setShows(d.shows || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [monday])

  const showsByDate = Object.fromEntries(shows.map(s => [s.show_date, s]))

  const deleteShow = async (id: string) => {
    await fetch(`/api/nlp/shows?id=${id}`, { method: 'DELETE' })
    setShows(s => s.filter(x => x.id !== id))
  }

  if (status === 'loading') return null

  const s = {
    shell: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' } as React.CSSProperties,
    sidebar: { background: '#080808', padding: 0, display: 'flex', flexDirection: 'column' as const },
    wordmark: { fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, color: 'white', letterSpacing: '-0.02em' },
    wordmarkSpan: { color: '#c0392b' },
    navItem: (active: boolean) => ({ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', fontSize: '13px', color: active ? 'white' : 'rgba(255,255,255,0.45)', background: active ? 'rgba(255,255,255,0.08)' : 'transparent', cursor: 'pointer', marginBottom: '2px', fontWeight: active ? 500 : 400 }),
  }

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
        <div style={{ padding: '20px 28px', borderBottom: '0.5px solid #e8e0d8', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 400, color: '#1a1210', margin: 0 }}>
              Upcoming Shows
            </h1>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '2px' }}>{weekLabel(monday)}</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button onClick={() => setWeekOffset(o => o - 1)} style={{ width: '32px', height: '32px', background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
            <button onClick={() => setWeekOffset(0)} style={{ padding: '6px 12px', background: weekOffset === 0 ? '#f0e8e0' : 'white', border: '0.5px solid #e8e0d8', borderRadius: '8px', cursor: 'pointer', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: '#555' }}>This week</button>
            <button onClick={() => setWeekOffset(o => o + 1)} style={{ width: '32px', height: '32px', background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '8px', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
            <button
              onClick={() => { setAddDate(null); setShowAddModal(true) }}
              style={{ padding: '9px 18px', background: '#c0392b', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', fontWeight: 500, marginLeft: '8px' }}
            >
              + Add show
            </button>
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px 28px', display: 'flex', gap: '24px' }}>
          {/* Week schedule */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {loading ? (
              <div style={{ fontSize: '13px', color: '#aaa', padding: '20px 0' }}>Loading schedule...</div>
            ) : weekDays.map((dateStr, i) => {
              const show = showsByDate[dateStr]
              const { day, num, month } = fmtDay(dateStr)
              return (
                <div
                  key={dateStr}
                  style={{
                    background: 'white',
                    border: show ? '0.5px solid #d4a0a0' : '0.5px solid #e8e0d8',
                    borderLeft: show ? '3px solid #c0392b' : '3px solid transparent',
                    borderRadius: '10px',
                    padding: '14px 18px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '16px',
                    cursor: 'pointer',
                    transition: 'border-color 0.15s',
                  }}
                  onClick={() => { setAddDate(dateStr); setShowAddModal(true) }}
                >
                  <div style={{ textAlign: 'center', minWidth: '40px' }}>
                    <div style={{ fontSize: '10px', color: '#aaa', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>{day}</div>
                    <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 400, color: '#1a1210', lineHeight: 1.1 }}>{num}</div>
                    <div style={{ fontSize: '10px', color: '#bbb' }}>{month}</div>
                  </div>
                  <div style={{ width: '0.5px', height: '36px', background: '#e8e0d8', flexShrink: 0 }} />
                  <div style={{ flex: 1 }}>
                    {show ? (
                      <>
                        <div style={{ fontSize: '14px', fontWeight: 500, color: '#1a1210' }}>{show.artist_name}</div>
                        {show.genre && <div style={{ fontSize: '11px', color: '#c0392b', marginTop: '2px', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>{show.genre}</div>}
                        {show.description && <div style={{ fontSize: '12px', color: '#888', marginTop: '3px' }}>{show.description}</div>}
                      </>
                    ) : (
                      <div style={{ fontSize: '13px', color: '#ccc' }}>No show — tap to add</div>
                    )}
                  </div>
                  {show && (
                    <button
                      onClick={e => { e.stopPropagation(); deleteShow(show.id) }}
                      style={{ background: 'none', border: 'none', fontSize: '16px', color: '#ddd', cursor: 'pointer', padding: '4px' }}
                    >
                      ×
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {/* Poster preview */}
          <div style={{ width: '280px', flexShrink: 0 }}>
            <div style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f0e8e0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', fontWeight: 500, color: '#555' }}>Weekly Poster</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => setPosterKey(k => k + 1)}
                    style={{ fontSize: '11px', color: '#888', background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px' }}
                    title="Refresh poster"
                  >
                    ↺
                  </button>
                  <a
                    href={posterUrl}
                    download={`nlp-week-${monday}.png`}
                    target="_blank"
                    rel="noreferrer"
                    style={{ fontSize: '11px', padding: '3px 10px', background: '#c0392b', color: 'white', borderRadius: '6px', textDecoration: 'none' }}
                  >
                    Download
                  </a>
                </div>
              </div>
              <img
                key={posterKey}
                src={posterUrl}
                alt="Weekly poster"
                style={{ width: '100%', display: 'block' }}
              />
            </div>
            <p style={{ fontSize: '11px', color: '#bbb', textAlign: 'center', marginTop: '10px' }}>
              Instagram-ready · 1080×1080px
            </p>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddShowModal
          initialDate={addDate || monday}
          weekDays={weekDays}
          onClose={() => { setShowAddModal(false); setAddDate(null) }}
          onAdd={(show) => {
            setShows(s => [...s.filter(x => x.show_date !== show.show_date), show])
            setShowAddModal(false)
            setPosterKey(k => k + 1)
          }}
        />
      )}
    </div>
  )
}

function AddShowModal({ initialDate, weekDays, onClose, onAdd }: {
  initialDate: string
  weekDays: string[]
  onClose: () => void
  onAdd: (s: Show) => void
}) {
  const [form, setForm] = useState({ showDate: initialDate, artistName: '', genre: '', description: '', ticketPrice: '' })
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
    onAdd({ ...show, show_date: show.showDate, artist_name: show.artistName })
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
          {weekDays.map(d => {
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

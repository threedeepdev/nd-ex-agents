'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

type Wine = {
  id: string
  name: string
  producer?: string
  vintage?: number
  region?: string
  country?: string
  varietal?: string
  score?: number
  drinkFrom?: number
  drinkUntil?: number
  pairings?: string[]
  notes?: string
  addedDate?: string
  status: 'in_cellar' | 'consumed'
  consumedDate?: string
  myRating?: number
}

type Tab = 'cellar' | 'had'
type Message = { role: 'user' | 'assistant'; content: string }

export default function WineDashboard() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('cellar')
  const [wines, setWines] = useState<Wine[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [selectedWine, setSelectedWine] = useState<Wine | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    fetch('/api/cellar')
      .then(r => r.json())
      .then(d => { setWines(d.cellar || []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const cellar = wines.filter(w => w.status === 'in_cellar')
  const had = wines.filter(w => w.status === 'consumed')
  const readyNow = cellar.filter(w => w.drinkFrom && w.drinkFrom <= new Date().getFullYear())

  const sendChat = async () => {
    if (!chatInput.trim()) return
    const msg = chatInput
    setChatInput('')
    setMessages(m => [...m, { role: 'user', content: msg }])
    setChatLoading(true)
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    })
    const data = await res.json()
    setMessages(m => [...m, { role: 'assistant', content: data.reply }])
    setChatLoading(false)
  }

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async () => {
      const base64 = (reader.result as string).split(',')[1]
      setMessages(m => [...m, { role: 'user', content: '📷 [Wine bottle photo]' }])
      setChatLoading(true)
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Please identify this wine and add it to my cellar.',
          imageBase64: base64
        })
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.reply }])
      setChatLoading(false)
      fetch('/api/cellar').then(r => r.json()).then(d => setWines(d.cellar || []))
    }
    reader.readAsDataURL(file)
  }

  if (status === 'loading') return null

  const s = {
    shell: { display: 'grid', gridTemplateColumns: '220px 1fr', minHeight: '100vh', fontFamily: 'DM Sans, sans-serif' } as React.CSSProperties,
    sidebar: { background: '#1a0a0a', padding: '0', display: 'flex', flexDirection: 'column' as const },
    sidebarTop: { padding: '24px 20px', borderBottom: '0.5px solid rgba(255,255,255,0.08)' },
    wordmark: { fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, color: 'white', letterSpacing: '-0.02em' },
    wordmarkSpan: { color: '#c0392b' },
    userRow: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px' },
    avatar: { width: '28px', height: '28px', borderRadius: '50%', background: 'rgba(192,57,43,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 500, color: '#e88' },
    navSection: { padding: '16px 12px' },
    navLabel: { fontSize: '10px', color: 'rgba(255,255,255,0.3)', padding: '4px 8px', letterSpacing: '0.1em', textTransform: 'uppercase' as const },
    navItem: (active: boolean) => ({ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 8px', borderRadius: '8px', fontSize: '13px', color: active ? 'white' : 'rgba(255,255,255,0.5)', background: active ? 'rgba(255,255,255,0.08)' : 'transparent', cursor: 'pointer', marginBottom: '2px', fontWeight: active ? 500 : 400 }),
    main: { background: '#f9f6f1', display: 'grid', gridTemplateRows: 'auto 1fr auto', maxHeight: '100vh', overflow: 'hidden' },
    topbar: { padding: '20px 28px', borderBottom: '0.5px solid #e8e0d8', background: 'white', display: 'flex', alignItems: 'center', justifyContent: 'space-between' },
    content: { padding: '24px 28px', overflow: 'auto' },
    statGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' },
    stat: { background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '12px', padding: '14px' },
    statLabel: { fontSize: '11px', color: '#888', marginBottom: '4px' },
    statValue: { fontSize: '24px', fontWeight: 500, color: '#1a1210', fontFamily: 'Cormorant Garamond, serif' },
    tabs: { display: 'flex', gap: '0', borderBottom: '0.5px solid #e8e0d8', marginBottom: '20px' },
    tabBtn: (active: boolean) => ({ padding: '8px 16px', fontSize: '13px', color: active ? '#6B1414' : '#888', borderBottom: active ? '2px solid #6B1414' : '2px solid transparent', background: 'none', border: 'none', borderBottom2: active ? '2px solid #6B1414' : 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: active ? 500 : 400 }),
    wineGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '12px' },
    wineCard: { background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '12px', padding: '14px', cursor: 'pointer', transition: 'border-color 0.15s' },
    wineThumb: { width: '100%', height: '72px', background: '#fdf2f2', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '10px', fontSize: '28px' },
    addCard: { background: '#fdf9f6', border: '0.5px dashed #d4c4b8', borderRadius: '12px', padding: '14px', cursor: 'pointer', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', minHeight: '160px', gap: '8px' },
    chatArea: { borderTop: '0.5px solid #e8e0d8', background: 'white', display: 'flex', flexDirection: 'column' as const, height: '260px' },
    chatMessages: { flex: 1, overflowY: 'auto' as const, padding: '12px 20px', display: 'flex', flexDirection: 'column' as const, gap: '8px' },
    chatInputRow: { padding: '10px 16px', borderTop: '0.5px solid #e8e0d8', display: 'flex', gap: '8px', alignItems: 'center' },
  }

  return (
    <div style={s.shell}>
      <div style={s.sidebar}>
        <div style={s.sidebarTop}>
          <div style={s.wordmark}>nd<span style={s.wordmarkSpan}>-ex</span></div>
          <div style={s.userRow}>
            <div style={s.avatar}>{session?.user?.name?.[0] || 'J'}</div>
            <span style={{ fontSize: '12px', color: 'rgba(255,255,255,0.5)' }}>{session?.user?.name}</span>
          </div>
        </div>

        <div style={s.navSection}>
          <div style={s.navLabel}>Agents</div>
          <div style={s.navItem(true)}>🍷 Wine cellar</div>
          <div style={{ ...s.navItem(false), opacity: 0.4 }}>⚡ Code runner</div>
          <div style={{ ...s.navItem(false), opacity: 0.4 }}>🔍 Web scraper</div>
        </div>

        <div style={{ ...s.navSection, borderTop: '0.5px solid rgba(255,255,255,0.08)', paddingTop: '16px' }}>
          <div style={s.navLabel}>Wine</div>
          <div style={s.navItem(tab === 'cellar')} onClick={() => setTab('cellar')}>🏠 My cellar</div>
          <div style={s.navItem(tab === 'had')} onClick={() => setTab('had')}>★ Wines I've had</div>
        </div>

        <div style={{ marginTop: 'auto', padding: '16px 12px', borderTop: '0.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ ...s.navItem(false) }} onClick={() => signOut()}>← Sign out</div>
        </div>
      </div>

      <div style={s.main}>
        <div style={s.topbar}>
          <div>
            <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 400, color: '#1a1210' }}>
              {tab === 'cellar' ? 'My cellar' : "Wines I've had"}
            </h1>
            <p style={{ fontSize: '12px', color: '#888', marginTop: '1px' }}>
              {tab === 'cellar' ? 'Bottles you currently own' : 'Wines you\'ve tasted and rated'}
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            style={{ padding: '9px 18px', background: '#6B1414', color: 'white', border: 'none', borderRadius: '10px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', cursor: 'pointer', fontWeight: 500 }}
          >
            + Add wine
          </button>
        </div>

        <div style={s.content}>
          {tab === 'cellar' && (
            <>
              <div style={s.statGrid}>
                <div style={s.stat}>
                  <div style={s.statLabel}>Total bottles</div>
                  <div style={s.statValue}>{cellar.length}</div>
                </div>
                <div style={s.stat}>
                  <div style={s.statLabel}>Ready to drink</div>
                  <div style={{ ...s.statValue, color: '#0F6E56' }}>{readyNow.length}</div>
                </div>
                <div style={s.stat}>
                  <div style={s.statLabel}>Avg score</div>
                  <div style={s.statValue}>
                    {cellar.filter(w => w.score).length > 0
                      ? Math.round(cellar.filter(w => w.score).reduce((a, w) => a + (w.score || 0), 0) / cellar.filter(w => w.score).length)
                      : '—'}
                  </div>
                </div>
                <div style={s.stat}>
                  <div style={s.statLabel}>Regions</div>
                  <div style={s.statValue}>{new Set(cellar.map(w => w.region).filter(Boolean)).size || '—'}</div>
                </div>
              </div>

              <div style={s.wineGrid}>
                {loading ? (
                  <div style={{ color: '#888', fontSize: '13px', gridColumn: '1/-1', padding: '20px 0' }}>Loading your cellar...</div>
                ) : cellar.length === 0 ? (
                  <div style={{ color: '#888', fontSize: '13px', gridColumn: '1/-1', padding: '20px 0' }}>
                    Your cellar is empty. Add your first wine below or take a photo!
                  </div>
                ) : cellar.map(wine => (
                  <div key={wine.id} style={s.wineCard} onClick={() => setSelectedWine(wine)}>
                    <div style={s.wineThumb}>🍷</div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1210', marginBottom: '3px' }}>{wine.name}</div>
                    <div style={{ fontSize: '11px', color: '#888' }}>{[wine.region, wine.vintage].filter(Boolean).join(' · ')}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', paddingTop: '10px', borderTop: '0.5px solid #f0e8e0' }}>
                      {wine.score && (
                        <span style={{ fontSize: '11px', background: '#fdf2f2', color: '#6B1414', padding: '2px 7px', borderRadius: '20px', fontWeight: 500 }}>
                          {wine.score} pts
                        </span>
                      )}
                      {wine.drinkFrom && (
                        <span style={{ fontSize: '11px', color: wine.drinkFrom <= new Date().getFullYear() ? '#0F6E56' : '#aaa', fontWeight: wine.drinkFrom <= new Date().getFullYear() ? 500 : 400 }}>
                          {wine.drinkFrom <= new Date().getFullYear() ? 'Ready now' : `From ${wine.drinkFrom}`}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                <div style={s.addCard} onClick={() => setShowAddModal(true)}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'white', border: '0.5px solid #d4c4b8', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color: '#888' }}>+</div>
                  <div style={{ fontSize: '13px', color: '#888' }}>Add a wine</div>
                  <div style={{ fontSize: '11px', color: '#aaa' }}>Photo or form</div>
                </div>
              </div>
            </>
          )}

          {tab === 'had' && (
            <div style={s.wineGrid}>
              {had.length === 0 ? (
                <div style={{ color: '#888', fontSize: '13px', gridColumn: '1/-1' }}>No wines logged yet.</div>
              ) : had.map(wine => (
                <div key={wine.id} style={s.wineCard}>
                  <div style={s.wineThumb}>🍷</div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1210', marginBottom: '3px' }}>{wine.name}</div>
                  <div style={{ fontSize: '11px', color: '#888' }}>{wine.region} · {wine.vintage}</div>
                  {wine.myRating && (
                    <div style={{ marginTop: '8px', fontSize: '12px', color: '#6B1414', fontWeight: 500 }}>
                      {'★'.repeat(Math.round(wine.myRating / 2))} {wine.myRating}/10
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={s.chatArea}>
          <div style={{ padding: '8px 20px', borderBottom: '0.5px solid #e8e0d8', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 500, color: '#6B1414' }}>Vino</span>
            <span style={{ fontSize: '11px', color: '#aaa' }}>your sommelier</span>
          </div>
          <div style={s.chatMessages}>
            {messages.length === 0 && (
              <div style={{ fontSize: '13px', color: '#aaa', textAlign: 'center', marginTop: '20px' }}>
                Ask Vino anything about your wines, or take a photo to add a bottle...
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  background: m.role === 'user' ? '#6B1414' : 'white',
                  color: m.role === 'user' ? 'white' : '#1a1210',
                  border: m.role === 'assistant' ? '0.5px solid #e8e0d8' : 'none',
                  lineHeight: '1.5'
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div style={{ fontSize: '13px', color: '#aaa' }}>Vino is thinking...</div>
            )}
            <div ref={chatEndRef} />
          </div>
          <div style={s.chatInputRow}>
            <input
              type="file"
              accept="image/*"
              ref={fileRef}
              style={{ display: 'none' }}
              onChange={handlePhoto}
            />
            <button
              onClick={() => fileRef.current?.click()}
              style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#fdf2f2', border: '0.5px solid #e8e0d8', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              📷
            </button>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask Vino about your cellar..."
              style={{ flex: 1, border: '0.5px solid #e8e0d8', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', background: '#fafaf8', outline: 'none', color: '#1a1210' }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading}
              style={{ padding: '8px 14px', background: chatInput.trim() ? '#6B1414' : '#e8e0d8', color: chatInput.trim() ? 'white' : '#aaa', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: chatInput.trim() ? 'pointer' : 'default', fontFamily: 'DM Sans, sans-serif' }}
            >
              Send
            </button>
          </div>
        </div>
      </div>

      {showAddModal && (
        <AddWineModal
          onClose={() => setShowAddModal(false)}
          onAdd={(wine) => {
            setWines(w => [...w, wine])
            setShowAddModal(false)
          }}
        />
      )}

      {selectedWine && (
        <WineDetailModal wine={selectedWine} onClose={() => setSelectedWine(null)} />
      )}
    </div>
  )
}

function AddWineModal({ onClose, onAdd }: { onClose: () => void, onAdd: (w: Wine) => void }) {
  const [mode, setMode] = useState<'cellar' | 'had'>('cellar')
  const [form, setForm] = useState({ name: '', producer: '', vintage: '', region: '', varietal: '', score: '', notes: '', myRating: '7' })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.name) return
    setSaving(true)
    const body = {
      ...form,
      vintage: form.vintage ? parseInt(form.vintage) : undefined,
      score: form.score ? parseInt(form.score) : undefined,
      myRating: mode === 'had' ? parseInt(form.myRating) : undefined,
      status: mode === 'cellar' ? 'in_cellar' : 'consumed',
      consumedDate: mode === 'had' ? new Date().toISOString().split('T')[0] : undefined,
    }
    const res = await fetch('/api/cellar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    const wine = await res.json()
    onAdd(wine)
    setSaving(false)
  }

  const o: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
  const m: React.CSSProperties = { background: 'white', borderRadius: '16px', padding: '28px', width: '440px', maxHeight: '90vh', overflowY: 'auto' }
  const inp: React.CSSProperties = { width: '100%', border: '0.5px solid #e8e0d8', borderRadius: '8px', padding: '9px 12px', fontSize: '13px', fontFamily: 'DM Sans, sans-serif', color: '#1a1210', background: '#fafaf8', outline: 'none', marginBottom: '10px' }
  const lbl: React.CSSProperties = { fontSize: '11px', color: '#888', marginBottom: '4px', display: 'block' }

  return (
    <div style={o} onClick={onClose}>
      <div style={m} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 400 }}>Add a wine</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888' }}>×</button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
          {(['cellar', 'had'] as const).map(t => (
            <button key={t} onClick={() => setMode(t)} style={{ flex: 1, padding: '8px', borderRadius: '8px', border: mode === t ? '1.5px solid #6B1414' : '0.5px solid #e8e0d8', background: mode === t ? '#fdf2f2' : 'white', color: mode === t ? '#6B1414' : '#888', fontSize: '13px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: mode === t ? 500 : 400 }}>
              {t === 'cellar' ? '🏠 My cellar' : '★ Wines I\'ve had'}
            </button>
          ))}
        </div>

        <label style={lbl}>Wine name *</label>
        <input style={inp} placeholder="e.g. Château Margaux" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={lbl}>Producer</label>
            <input style={inp} placeholder="Producer" value={form.producer} onChange={e => setForm(f => ({ ...f, producer: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Vintage</label>
            <input style={inp} placeholder="2019" type="number" value={form.vintage} onChange={e => setForm(f => ({ ...f, vintage: e.target.value }))} />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          <div>
            <label style={lbl}>Region</label>
            <input style={inp} placeholder="Bordeaux" value={form.region} onChange={e => setForm(f => ({ ...f, region: e.target.value }))} />
          </div>
          <div>
            <label style={lbl}>Varietal</label>
            <input style={inp} placeholder="Cab Sauvignon" value={form.varietal} onChange={e => setForm(f => ({ ...f, varietal: e.target.value }))} />
          </div>
        </div>

        {mode === 'cellar' && (
          <>
            <label style={lbl}>Critic score (85–100)</label>
            <input style={inp} placeholder="94" type="number" min="85" max="100" value={form.score} onChange={e => setForm(f => ({ ...f, score: e.target.value }))} />
          </>
        )}

        {mode === 'had' && (
          <>
            <label style={lbl}>My rating: {form.myRating}/10</label>
            <input type="range" min="1" max="10" step="1" value={form.myRating} onChange={e => setForm(f => ({ ...f, myRating: e.target.value }))} style={{ width: '100%', marginBottom: '10px' }} />
          </>
        )}

        <label style={lbl}>Notes</label>
        <textarea style={{ ...inp, height: '70px', resize: 'none' as const }} placeholder="Tasting notes..." value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />

        <button
          onClick={submit}
          disabled={!form.name || saving}
          style={{ width: '100%', padding: '12px', background: form.name ? '#6B1414' : '#e8e0d8', color: form.name ? 'white' : '#aaa', border: 'none', borderRadius: '10px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: form.name ? 'pointer' : 'default', marginTop: '4px' }}
        >
          {saving ? 'Saving...' : mode === 'cellar' ? 'Add to my cellar' : "Add to wines I've had"}
        </button>
      </div>
    </div>
  )
}

function WineDetailModal({ wine, onClose }: { wine: Wine, onClose: () => void }) {
  const o: React.CSSProperties = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }
  const m: React.CSSProperties = { background: 'white', borderRadius: '16px', padding: '28px', width: '400px' }
  return (
    <div style={o} onClick={onClose}>
      <div style={m} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ fontSize: '36px' }}>🍷</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '18px', cursor: 'pointer', color: '#888' }}>×</button>
        </div>
        <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 400, marginBottom: '4px' }}>{wine.name}</h2>
        <p style={{ fontSize: '13px', color: '#888', marginBottom: '16px' }}>{[wine.producer, wine.vintage].filter(Boolean).join(' · ')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
          {[['Region', wine.region], ['Varietal', wine.varietal], ['Score', wine.score ? `${wine.score} pts` : undefined], ['Drink window', wine.drinkFrom ? `${wine.drinkFrom}–${wine.drinkUntil}` : undefined]].filter(([, v]) => v).map(([k, v]) => (
            <div key={String(k)} style={{ background: '#fdf9f6', borderRadius: '8px', padding: '10px' }}>
              <div style={{ fontSize: '11px', color: '#888', marginBottom: '2px' }}>{k}</div>
              <div style={{ fontSize: '13px', fontWeight: 500, color: '#1a1210' }}>{String(v)}</div>
            </div>
          ))}
        </div>
        {wine.pairings && wine.pairings.length > 0 && (
          <div>
            <div style={{ fontSize: '11px', color: '#888', marginBottom: '6px' }}>Pairings</div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {wine.pairings.map(p => (
                <span key={p} style={{ fontSize: '12px', background: '#fdf2f2', color: '#6B1414', padding: '3px 9px', borderRadius: '20px' }}>{p}</span>
              ))}
            </div>
          </div>
        )}
        {wine.notes && <p style={{ fontSize: '13px', color: '#666', marginTop: '12px', fontStyle: 'italic', lineHeight: 1.5 }}>{wine.notes}</p>}
      </div>
    </div>
  )
}

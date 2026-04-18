'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }
type Task = {
  id: string
  name: string
  description?: string
  message: string
  schedule: string
  enabled: boolean
  created_at: string
  last_run_at?: string
  next_run_at?: string
  lastRun?: { status: string; result?: string; completed_at?: string } | null
}

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

function scheduleLabel(s: string) {
  return s === 'hourly' ? 'Every hour' : s === 'daily' ? 'Daily 9am' : s === 'weekly' ? 'Weekly Mon' : s
}

function timeAgo(iso?: string) {
  if (!iso) return null
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const SCHEDULE_OPTIONS = [
  { value: 'hourly', label: 'Every hour' },
  { value: 'daily', label: 'Daily at 9am' },
  { value: 'weekly', label: 'Weekly (Mon 9am)' },
]

export default function DashboardHome() {
  const { status } = useSession()
  const router = useRouter()

  // Chat
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Tasks
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [showAddTask, setShowAddTask] = useState(false)
  const [runningTaskId, setRunningTaskId] = useState<string | null>(null)
  const [expandedTask, setExpandedTask] = useState<string | null>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    fetch('/api/tasks')
      .then(r => r.json())
      .then(d => { setTasks(d.tasks || []); setTasksLoading(false) })
      .catch(() => setTasksLoading(false))
  }, [])

  if (status === 'loading') return null

  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return
    const msg = chatInput.trim()
    setChatInput('')
    setMessages(m => [...m, { role: 'user', content: msg }])
    setChatLoading(true)
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg }),
      })
      const data = await res.json()
      setMessages(m => [...m, { role: 'assistant', content: data.reply || 'No response.' }])
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Something went wrong. Try again.' }])
    }
    setChatLoading(false)
  }

  const runTask = async (taskId: string) => {
    setRunningTaskId(taskId)
    try {
      await fetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      const d = await fetch('/api/tasks').then(r => r.json())
      setTasks(d.tasks || [])
    } catch { /* ignore */ }
    setRunningTaskId(null)
  }

  const toggleTask = async (id: string, enabled: boolean) => {
    setTasks(t => t.map(task => task.id === id ? { ...task, enabled } : task))
    await fetch('/api/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, enabled }),
    })
  }

  const deleteTask = async (id: string) => {
    setTasks(t => t.filter(task => task.id !== id))
    await fetch(`/api/tasks?id=${id}`, { method: 'DELETE' })
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9f6f1', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Top nav */}
      <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #e8e0d8', background: 'white', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '-0.02em', color: '#1a1210' }}>
          nd<span style={{ color: '#c0392b' }}>-ex</span>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: '12px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: '680px', width: '100%', margin: '0 auto', padding: '0 20px 48px' }}>
        {/* Greeting */}
        <div style={{ paddingTop: '40px', paddingBottom: '28px' }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '38px', fontWeight: 300, color: '#1a1210', margin: 0, letterSpacing: '-0.01em' }}>
            {getGreeting()}, Justin.
          </h1>
          <p style={{ fontSize: '13px', color: '#aaa', marginTop: '5px' }}>What would you like to work on today?</p>
        </div>

        {/* Agent cards */}
        <div style={{ marginBottom: '28px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <div
            onClick={() => router.push('/dashboard/wine')}
            style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '14px', padding: '18px 20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '12px' }}
          >
            <span style={{ fontSize: '24px' }}>🍷</span>
            <div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', fontWeight: 400, color: '#1a1210' }}>Wine Cellar</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>Open →</div>
            </div>
          </div>
          <div
            onClick={() => router.push('/dashboard/nlp')}
            style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '14px', padding: '18px 20px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '12px' }}
          >
            <span style={{ fontSize: '24px' }}>🎵</span>
            <div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', fontWeight: 400, color: '#1a1210' }}>NLP</div>
              <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>Nikki Lopez →</div>
            </div>
          </div>
        </div>

        {/* Chat panel */}
        <div style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '16px', overflow: 'hidden', marginBottom: '20px' }}>
          <div style={{ padding: '11px 16px', borderBottom: '0.5px solid #f0e8e0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B1414', letterSpacing: '0.04em', textTransform: 'uppercase' }}>🍷 Vino</span>
            <span style={{ fontSize: '11px', color: '#bbb' }}>your sommelier</span>
          </div>

          <div style={{ minHeight: '120px', maxHeight: '280px', overflowY: 'auto', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {messages.length === 0 && (
              <div style={{ fontSize: '13px', color: '#bbb', textAlign: 'center', marginTop: '24px' }}>
                Ask Vino anything about your wine collection...
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{ maxWidth: '78%', padding: '8px 12px', borderRadius: '12px', fontSize: '13px', lineHeight: '1.55', background: m.role === 'user' ? '#6B1414' : '#fdf9f6', color: m.role === 'user' ? 'white' : '#1a1210', border: m.role === 'assistant' ? '0.5px solid #e8e0d8' : 'none' }}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && <div style={{ fontSize: '13px', color: '#aaa', fontStyle: 'italic' }}>Vino is thinking...</div>}
            <div ref={chatEndRef} />
          </div>

          <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e8e0d8', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask anything..."
              style={{ flex: 1, border: '0.5px solid #e8e0d8', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', background: '#fafaf8', outline: 'none', color: '#1a1210' }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || chatLoading}
              style={{ padding: '9px 16px', background: chatInput.trim() && !chatLoading ? '#6B1414' : '#ede8e3', color: chatInput.trim() && !chatLoading ? 'white' : '#bbb', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: chatInput.trim() && !chatLoading ? 'pointer' : 'default', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}
            >
              Send
            </button>
          </div>
        </div>

        {/* Tasks panel */}
        <div style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '16px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f0e8e0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B1414', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Scheduled Tasks</span>
              {tasks.length > 0 && (
                <span style={{ fontSize: '11px', background: '#fdf2f2', color: '#6B1414', padding: '1px 7px', borderRadius: '20px' }}>{tasks.length}</span>
              )}
            </div>
            <button
              onClick={() => setShowAddTask(true)}
              style={{ fontSize: '12px', padding: '5px 12px', background: '#6B1414', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}
            >
              + Add task
            </button>
          </div>

          <div style={{ padding: tasks.length === 0 ? '24px 16px' : '0' }}>
            {tasksLoading ? (
              <p style={{ fontSize: '13px', color: '#bbb', textAlign: 'center' }}>Loading tasks...</p>
            ) : tasks.length === 0 ? (
              <p style={{ fontSize: '13px', color: '#bbb', textAlign: 'center' }}>
                No tasks yet. Add one to automate your agents.
              </p>
            ) : tasks.map((task, i) => (
              <div key={task.id} style={{ borderBottom: i < tasks.length - 1 ? '0.5px solid #f4ede8' : 'none' }}>
                {/* Task row */}
                <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                  {/* Status dot */}
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: task.enabled ? '#0F6E56' : '#ccc', marginTop: '5px', flexShrink: 0 }} />

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '13px', fontWeight: 500, color: '#1a1210' }}>{task.name}</span>
                      <span style={{ fontSize: '10px', background: '#f4ede8', color: '#888', padding: '1px 7px', borderRadius: '20px' }}>{scheduleLabel(task.schedule)}</span>
                    </div>
                    {task.lastRun ? (
                      <div style={{ fontSize: '11px', color: '#aaa' }}>
                        {task.lastRun.status === 'completed' ? '✓' : task.lastRun.status === 'failed' ? '✗' : '⋯'}{' '}
                        {timeAgo(task.lastRun.completed_at)}
                        {task.lastRun.result && (
                          <button
                            onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                            style={{ marginLeft: '8px', fontSize: '11px', color: '#6B1414', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontFamily: 'DM Sans, sans-serif' }}
                          >
                            {expandedTask === task.id ? 'hide result' : 'see result'}
                          </button>
                        )}
                      </div>
                    ) : (
                      <div style={{ fontSize: '11px', color: '#bbb' }}>Never run · next {timeAgo(task.next_run_at) ? `in ${task.next_run_at ? new Date(task.next_run_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}` : '—'}</div>
                    )}
                  </div>

                  {/* Actions */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexShrink: 0 }}>
                    <button
                      onClick={() => runTask(task.id)}
                      disabled={runningTaskId === task.id}
                      style={{ fontSize: '11px', padding: '4px 10px', background: '#fdf9f6', border: '0.5px solid #e8e0d8', borderRadius: '6px', cursor: 'pointer', color: '#888', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {runningTaskId === task.id ? '...' : '▶ Run'}
                    </button>
                    <button
                      onClick={() => toggleTask(task.id, !task.enabled)}
                      style={{ fontSize: '11px', padding: '4px 8px', background: task.enabled ? '#fdf2f2' : '#f4f4f0', border: '0.5px solid #e8e0d8', borderRadius: '6px', cursor: 'pointer', color: task.enabled ? '#6B1414' : '#aaa', fontFamily: 'DM Sans, sans-serif' }}
                    >
                      {task.enabled ? 'On' : 'Off'}
                    </button>
                    <button
                      onClick={() => deleteTask(task.id)}
                      style={{ fontSize: '13px', padding: '2px 6px', background: 'none', border: 'none', cursor: 'pointer', color: '#ccc' }}
                    >
                      ×
                    </button>
                  </div>
                </div>

                {/* Expanded result */}
                {expandedTask === task.id && task.lastRun?.result && (
                  <div style={{ padding: '0 16px 14px 36px' }}>
                    <div style={{ background: '#fdf9f6', border: '0.5px solid #e8e0d8', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#555', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                      {task.lastRun.result}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddTask && (
        <AddTaskModal
          onClose={() => setShowAddTask(false)}
          onAdd={(task) => { setTasks(t => [task, ...t]); setShowAddTask(false) }}
        />
      )}
    </div>
  )
}

function AddTaskModal({ onClose, onAdd }: { onClose: () => void; onAdd: (t: Task) => void }) {
  const [form, setForm] = useState({ name: '', description: '', message: '', schedule: 'daily' })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    if (!form.name || !form.message) return
    setSaving(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const task = await res.json()
    onAdd(task)
    setSaving(false)
  }

  const inp: React.CSSProperties = { width: '100%', border: '0.5px solid #e8e0d8', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', color: '#1a1210', background: '#fafaf8', outline: 'none', marginBottom: '12px', boxSizing: 'border-box' }
  const lbl: React.CSSProperties = { fontSize: '11px', color: '#888', marginBottom: '4px', display: 'block' }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: '16px' }} onClick={onClose}>
      <div style={{ background: 'white', borderRadius: '16px', padding: '28px', width: '460px', maxWidth: '100%' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '22px' }}>
          <h2 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 400, margin: 0 }}>New scheduled task</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#aaa' }}>×</button>
        </div>

        <label style={lbl}>Task name *</label>
        <input style={inp} placeholder="e.g. Scan auction deals" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />

        <label style={lbl}>Description</label>
        <input style={inp} placeholder="Optional note about this task" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />

        <label style={lbl}>What should Vino do? *</label>
        <textarea
          style={{ ...inp, height: '90px', resize: 'none' as const }}
          placeholder="e.g. Search major wine auction sites (Zachys, Acker, WineBid) for deals on Burgundy and Bordeaux similar to my cellar. List top 5 with estimated savings."
          value={form.message}
          onChange={e => setForm(f => ({ ...f, message: e.target.value }))}
        />

        <label style={lbl}>Schedule</label>
        <select
          value={form.schedule}
          onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}
          style={{ ...inp, marginBottom: '20px', cursor: 'pointer' }}
        >
          {SCHEDULE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>

        <button
          onClick={submit}
          disabled={!form.name || !form.message || saving}
          style={{ width: '100%', padding: '12px', background: form.name && form.message ? '#6B1414' : '#e8e0d8', color: form.name && form.message ? 'white' : '#aaa', border: 'none', borderRadius: '10px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', fontWeight: 500, cursor: form.name && form.message ? 'pointer' : 'default' }}
        >
          {saving ? 'Saving...' : 'Create task'}
        </button>
      </div>
    </div>
  )
}

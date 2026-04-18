'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'

type Message = { role: 'user' | 'assistant'; content: string }

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const agents = [
  { id: 'wine', emoji: '🍷', name: 'Wine Cellar', href: '/dashboard/wine', available: true },
]

const chatAgents = [
  { id: 'vino', label: '🍷 Vino — Wine Sommelier' },
]

export default function DashboardHome() {
  const { status } = useSession()
  const router = useRouter()
  const [chatInput, setChatInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedAgent, setSelectedAgent] = useState('vino')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  if (status === 'loading') return null

  const sendChat = async () => {
    if (!chatInput.trim() || loading) return
    const msg = chatInput.trim()
    setChatInput('')
    setMessages(m => [...m, { role: 'user', content: msg }])
    setLoading(true)
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
    setLoading(false)
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9f6f1', fontFamily: 'DM Sans, sans-serif', display: 'flex', flexDirection: 'column' }}>
      {/* Top nav */}
      <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #e8e0d8', background: 'white', flexShrink: 0 }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '-0.02em', color: '#1a1210' }}>
          nd<span style={{ color: '#c0392b' }}>-ex</span>
        </div>
        <button onClick={() => signOut({ callbackUrl: '/login' })} style={{ fontSize: '12px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: '680px', width: '100%', margin: '0 auto', padding: '0 20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Greeting */}
        <div style={{ paddingTop: '40px', paddingBottom: '28px', flexShrink: 0 }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '38px', fontWeight: 300, color: '#1a1210', margin: 0, letterSpacing: '-0.01em' }}>
            {getGreeting()}, Justin.
          </h1>
          <p style={{ fontSize: '13px', color: '#aaa', marginTop: '5px' }}>
            What would you like to work on today?
          </p>
        </div>

        {/* Agent cards */}
        <div style={{ display: 'flex', gap: '12px', marginBottom: '28px', flexShrink: 0 }}>
          {agents.map(agent => (
            <div
              key={agent.id}
              onClick={() => agent.available && router.push(agent.href)}
              style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '14px', padding: '18px 20px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}
            >
              <span style={{ fontSize: '24px' }}>{agent.emoji}</span>
              <div>
                <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '17px', fontWeight: 400, color: '#1a1210' }}>{agent.name}</div>
                <div style={{ fontSize: '11px', color: '#aaa', marginTop: '1px' }}>Open →</div>
              </div>
            </div>
          ))}
        </div>

        {/* Chat panel */}
        <div style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '16px', overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column', marginBottom: '24px', minHeight: '320px' }}>
          {/* Agent selector header */}
          <div style={{ padding: '12px 16px', borderBottom: '0.5px solid #f0e8e0', display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            <span style={{ fontSize: '11px', color: '#888' }}>Chat with</span>
            <select
              value={selectedAgent}
              onChange={e => setSelectedAgent(e.target.value)}
              style={{ fontSize: '13px', fontWeight: 500, color: '#6B1414', background: 'none', border: 'none', outline: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif', appearance: 'none', padding: '0 4px' }}
            >
              {chatAgents.map(a => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {messages.length === 0 && (
              <div style={{ fontSize: '13px', color: '#bbb', textAlign: 'center', marginTop: '32px' }}>
                Ask Vino anything about your wine collection...
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '78%',
                  padding: '9px 13px',
                  borderRadius: '12px',
                  fontSize: '13px',
                  lineHeight: '1.55',
                  background: m.role === 'user' ? '#6B1414' : '#fdf9f6',
                  color: m.role === 'user' ? 'white' : '#1a1210',
                  border: m.role === 'assistant' ? '0.5px solid #e8e0d8' : 'none',
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ fontSize: '13px', color: '#aaa', fontStyle: 'italic' }}>Vino is thinking...</div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input row */}
          <div style={{ padding: '10px 14px', borderTop: '0.5px solid #e8e0d8', display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendChat()}
              placeholder="Ask anything..."
              style={{ flex: 1, border: '0.5px solid #e8e0d8', borderRadius: '8px', padding: '9px 12px', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', background: '#fafaf8', outline: 'none', color: '#1a1210' }}
            />
            <button
              onClick={sendChat}
              disabled={!chatInput.trim() || loading}
              style={{ padding: '9px 16px', background: chatInput.trim() && !loading ? '#6B1414' : '#ede8e3', color: chatInput.trim() && !loading ? 'white' : '#bbb', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: chatInput.trim() && !loading ? 'pointer' : 'default', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

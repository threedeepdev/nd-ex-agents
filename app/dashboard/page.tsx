'use client'
import { useSession, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

function getGreeting() {
  const h = new Date().getHours()
  if (h < 12) return 'Good morning'
  if (h < 17) return 'Good afternoon'
  return 'Good evening'
}

const agents = [
  {
    id: 'wine',
    emoji: '🍷',
    name: 'Wine Cellar',
    description: 'Manage your collection, track bottles, and get pairing advice from your sommelier.',
    href: '/dashboard/wine',
    available: true,
  },
  {
    id: 'code',
    emoji: '⚡',
    name: 'Code Runner',
    description: 'Write, run, and debug code snippets in any language.',
    href: '/dashboard/code',
    available: false,
  },
  {
    id: 'scraper',
    emoji: '🔍',
    name: 'Web Scraper',
    description: 'Extract data and monitor websites automatically.',
    href: '/dashboard/scraper',
    available: false,
  },
]

export default function DashboardHome() {
  const { status } = useSession()
  const router = useRouter()
  const [chatInput, setChatInput] = useState('')

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  if (status === 'loading') return null

  return (
    <div style={{ minHeight: '100vh', background: '#f9f6f1', fontFamily: 'DM Sans, sans-serif' }}>
      {/* Top nav */}
      <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '0.5px solid #e8e0d8', background: 'white' }}>
        <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '22px', fontWeight: 300, letterSpacing: '-0.02em', color: '#1a1210' }}>
          nd<span style={{ color: '#c0392b' }}>-ex</span>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: '/login' })}
          style={{ fontSize: '12px', color: '#aaa', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}
        >
          Sign out
        </button>
      </div>

      <div style={{ maxWidth: '720px', margin: '0 auto', padding: '0 24px' }}>
        {/* Greeting */}
        <div style={{ paddingTop: '52px', paddingBottom: '36px' }}>
          <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '42px', fontWeight: 300, color: '#1a1210', margin: 0, letterSpacing: '-0.01em' }}>
            {getGreeting()}, Justin.
          </h1>
          <p style={{ fontSize: '14px', color: '#aaa', marginTop: '6px' }}>
            What would you like to work on today?
          </p>
        </div>

        {/* Agent cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px', marginBottom: '36px' }}>
          {agents.map(agent => (
            <div
              key={agent.id}
              onClick={() => agent.available && router.push(agent.href)}
              style={{
                background: 'white',
                border: '0.5px solid #e8e0d8',
                borderRadius: '16px',
                padding: '22px',
                cursor: agent.available ? 'pointer' : 'default',
                opacity: agent.available ? 1 : 0.5,
                position: 'relative',
              }}
            >
              <div style={{ fontSize: '30px', marginBottom: '12px' }}>{agent.emoji}</div>
              <div style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: '19px', fontWeight: 400, color: '#1a1210', marginBottom: '5px' }}>
                {agent.name}
              </div>
              <div style={{ fontSize: '12px', color: '#999', lineHeight: 1.55 }}>
                {agent.description}
              </div>
              {!agent.available && (
                <div style={{ marginTop: '10px', fontSize: '10px', color: '#bbb', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                  Coming soon
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Chat input */}
        <div style={{ background: 'white', border: '0.5px solid #e8e0d8', borderRadius: '14px', overflow: 'hidden', marginBottom: '48px' }}>
          <div style={{ padding: '10px 16px 4px', borderBottom: '0.5px solid #f4ede8' }}>
            <span style={{ fontSize: '11px', fontWeight: 500, color: '#6B1414', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
              Ask your agents
            </span>
          </div>
          <div style={{ padding: '10px 16px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              placeholder="Ask anything across your agents..."
              style={{ flex: 1, border: 'none', fontSize: '14px', fontFamily: 'DM Sans, sans-serif', background: 'transparent', outline: 'none', color: '#1a1210', padding: '4px 0' }}
            />
            <button
              disabled={!chatInput.trim()}
              style={{ padding: '8px 16px', background: chatInput.trim() ? '#6B1414' : '#ede8e3', color: chatInput.trim() ? 'white' : '#bbb', border: 'none', borderRadius: '8px', fontSize: '13px', cursor: chatInput.trim() ? 'pointer' : 'default', fontFamily: 'DM Sans, sans-serif', flexShrink: 0 }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

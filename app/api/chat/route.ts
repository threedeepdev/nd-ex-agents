import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL!
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!

async function getCellarContext(): Promise<string> {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const rows = await sql`
      SELECT name, producer, vintage, region, varietal, score, status, my_rating
      FROM wines ORDER BY added_date DESC
    `
    if (rows.length === 0) return 'The cellar is currently empty.'
    return rows.map(r => {
      const details = [r.name, r.producer, r.vintage, r.region, r.varietal].filter(Boolean).join(', ')
      const meta = [
        r.status === 'in_cellar' ? 'in cellar' : 'consumed',
        r.score ? `critic score: ${r.score}` : null,
        r.my_rating ? `my rating: ${r.my_rating}/10` : null,
      ].filter(Boolean).join(', ')
      return `- ${details} (${meta})`
    }).join('\n')
  } catch {
    return 'Cellar data unavailable.'
  }
}

async function getShowsContext(): Promise<string> {
  try {
    const sql = neon(process.env.DATABASE_URL!)
    const today = new Date().toISOString().split('T')[0]
    const twoWeeksOut = new Date()
    twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)
    const until = twoWeeksOut.toISOString().split('T')[0]
    const rows = await sql`
      SELECT show_date, artist_name, genre, description
      FROM nlp_shows
      WHERE show_date >= ${today} AND show_date <= ${until}
      ORDER BY show_date
    `
    if (rows.length === 0) return 'No upcoming shows scheduled in the next two weeks.'
    return rows.map(r => {
      const parts = [`${r.show_date}: ${r.artist_name}`]
      if (r.genre) parts.push(`(${r.genre})`)
      if (r.description) parts.push(`— ${r.description}`)
      return parts.join(' ')
    }).join('\n')
  } catch {
    return 'Show data unavailable.'
  }
}

async function chatViaOpenClaw(agentId: string, message: string, sessionId: string, imageBase64?: string): Promise<string> {
  const body: Record<string, unknown> = { agentId, message, sessionId }
  if (imageBase64) body.attachments = [{ type: 'image', data: imageBase64 }]
  const res = await fetch(`${GATEWAY}/api/agent/message`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`OpenClaw ${res.status}`)
  const data = await res.json()
  return data.message || data.content || data.reply || 'No response'
}

async function chatViaClaude(agentId: string, message: string, imageBase64?: string, mimeType = 'image/jpeg'): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

  let system: string
  if (agentId === 'nlp') {
    const showsContext = await getShowsContext()
    system = `You are the NLP assistant for Nikki Lopez Philly, a live music venue in Philadelphia. You help with the show schedule, upcoming events, and venue questions.

Upcoming shows:
${showsContext}

Be concise, helpful, and enthusiastic about live music.`
  } else {
    const cellarContext = await getCellarContext()
    system = `You are Vino, a knowledgeable sommelier assistant for Justin. You help manage his wine cellar, suggest pairings, and answer wine questions.

Justin's current cellar:
${cellarContext}

Be concise and warm.`
  }

  const content: Anthropic.ContentBlockParam[] = []
  if (imageBase64) {
    content.push({
      type: 'image',
      source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp', data: imageBase64 },
    })
  }
  content.push({ type: 'text', text: message })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content }],
  })
  return response.content[0].type === 'text' ? response.content[0].text : 'No response'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, imageBase64, mimeType, agentId = 'vino' } = await req.json()
  const sessionId = agentId === 'nlp' ? 'web-nlp' : 'web-cellar'

  try {
    const reply = await chatViaOpenClaw(agentId, message, sessionId, imageBase64)
    return NextResponse.json({ reply, source: 'openclaw' })
  } catch (err) {
    console.warn(`OpenClaw unavailable for ${agentId}, falling back to Claude:`, err)
    const reply = await chatViaClaude(agentId, message, imageBase64, mimeType)
    return NextResponse.json({ reply, source: 'claude' })
  }
}

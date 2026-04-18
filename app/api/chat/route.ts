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

async function chatViaOpenClaw(message: string, imageBase64?: string): Promise<string> {
  const body: Record<string, unknown> = {
    agentId: 'vino',
    message,
    sessionId: 'web-cellar',
  }
  if (imageBase64) {
    body.attachments = [{ type: 'image', data: imageBase64 }]
  }
  const res = await fetch(`${GATEWAY}/api/agent/message`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })
  if (!res.ok) throw new Error(`OpenClaw ${res.status}`)
  const data = await res.json()
  return data.message || data.content || data.reply || 'No response'
}

async function chatViaClaude(message: string, imageBase64?: string, mimeType = 'image/jpeg'): Promise<string> {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })
  const cellarContext = await getCellarContext()
  const system = `You are Vino, a knowledgeable sommelier assistant for Justin. You help manage his wine cellar, suggest pairings, and answer wine questions.

Justin's current cellar:
${cellarContext}

Be concise and warm.`

  const content: Anthropic.ContentBlockParam[] = []
  if (imageBase64) {
    content.push({
      type: 'image',
      source: {
        type: 'base64',
        media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp',
        data: imageBase64,
      },
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

  const { message, imageBase64, mimeType } = await req.json()

  // Try OpenClaw first, fall back to direct Claude if unavailable
  try {
    const reply = await chatViaOpenClaw(message, imageBase64)
    return NextResponse.json({ reply, source: 'openclaw' })
  } catch (err) {
    console.warn('OpenClaw unavailable, falling back to Claude:', err)
    const reply = await chatViaClaude(message, imageBase64, mimeType)
    return NextResponse.json({ reply, source: 'claude' })
  }
}

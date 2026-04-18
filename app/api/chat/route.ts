import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'
import { neon } from '@neondatabase/serverless'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

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

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, imageBase64, mimeType = 'image/jpeg' } = await req.json()

  const cellarContext = await getCellarContext()

  const system = `You are Vino, a knowledgeable and warm sommelier assistant for Justin. You help him manage his wine cellar, suggest food pairings, identify wines from photos, and answer wine questions.

Justin's current cellar:
${cellarContext}

Be concise and conversational. When asked about his wines, refer to the list above. For pairings, be specific and practical.`

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

  const reply = response.content[0].type === 'text' ? response.content[0].text : 'No response'
  return NextResponse.json({ reply })
}

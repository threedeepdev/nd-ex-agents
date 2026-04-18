import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! })

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { imageBase64, mimeType = 'image/jpeg' } = await req.json()
  if (!imageBase64) return NextResponse.json({ error: 'No image provided' }, { status: 400 })

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mimeType, data: imageBase64 },
          },
          {
            type: 'text',
            text: 'Identify this wine from the label. Return ONLY a valid JSON object with no other text, markdown, or explanation. Use this exact structure: {"name":"","producer":"","vintage":null,"region":"","varietal":"","estimatedRetailCost":null}. For estimatedRetailCost provide a number in USD. If you cannot determine a field, use null or empty string.',
          },
        ],
      },
    ],
  })

  const raw = message.content[0].type === 'text' ? message.content[0].text : ''

  try {
    const match = raw.match(/\{[\s\S]*\}/)
    const wine = match ? JSON.parse(match[0]) : {}
    return NextResponse.json(wine)
  } catch {
    return NextResponse.json({})
  }
}

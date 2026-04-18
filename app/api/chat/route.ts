import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL!
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { message, imageBase64 } = await req.json()

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
    body: JSON.stringify(body)
  })

  if (!res.ok) {
    return NextResponse.json({ error: 'Agent error' }, { status: 500 })
  }

  const data = await res.json()
  return NextResponse.json({ reply: data.message || data.content || 'No response' })
}

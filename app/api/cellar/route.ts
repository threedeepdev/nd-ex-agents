import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL!
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!

async function fetchCellar() {
  const res = await fetch(`${GATEWAY}/api/workspace/file`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId: 'vino',
      path: '/home/openclaw/.openclaw/workspace/wine-cellar/cellar.json',
      action: 'read'
    })
  })
  if (!res.ok) return { cellar: [] }
  const data = await res.json()
  try { return JSON.parse(data.content) } catch { return { cellar: [] } }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const data = await fetchCellar()
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ cellar: [] })
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const wine = await req.json()
  const current = await fetchCellar()
  
  const newWine = {
    id: `wine-${String(current.cellar.length + 1).padStart(3, '0')}`,
    ...wine,
    addedDate: new Date().toISOString().split('T')[0],
    status: wine.status || 'in_cellar'
  }

  current.cellar.push(newWine)

  await fetch(`${GATEWAY}/api/workspace/file`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      agentId: 'vino',
      path: '/home/openclaw/.openclaw/workspace/wine-cellar/cellar.json',
      action: 'write',
      content: JSON.stringify(current, null, 2)
    })
  })

  return NextResponse.json(newWine)
}

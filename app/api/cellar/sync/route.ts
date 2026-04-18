import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL!
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!
const CELLAR_MD_PATH = '/home/openclaw/.openclaw/agents/wine/CELLAR.md'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT * FROM wines ORDER BY added_date DESC`

  const cellar = rows.filter(r => r.status === 'in_cellar')
  const had = rows.filter(r => r.status === 'consumed' || (r.status === 'in_cellar' && r.tasted))
  const now = new Date().toISOString().split('T')[0]

  const wineRow = (r: Record<string, unknown>) => {
    const parts = [r.name, r.producer, r.vintage, r.region, r.varietal].filter(Boolean).join(', ')
    const extras = [
      r.score ? `critic score: ${r.score}` : null,
      r.estimated_retail_cost ? `est. $${r.estimated_retail_cost}` : null,
      r.my_rating ? `my rating: ${r.my_rating}/10` : null,
      r.notes ? `notes: ${r.notes}` : null,
    ].filter(Boolean).join(' · ')
    return `- ${parts}${extras ? ` (${extras})` : ''}`
  }

  const content = `# Justin's Wine Cellar
Last synced: ${now}

## In Cellar (${cellar.length} bottle${cellar.length !== 1 ? 's' : ''})
${cellar.length === 0 ? '_Empty_' : cellar.map(wineRow).join('\n')}

## Wines I've Had (${had.length})
${had.length === 0 ? '_None logged_' : had.map(wineRow).join('\n')}
`

  const res = await fetch(`${GATEWAY}/api/workspace/file`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId: 'vino', path: CELLAR_MD_PATH, action: 'write', content }),
  })

  if (!res.ok) return NextResponse.json({ error: 'OpenClaw sync failed' }, { status: 500 })

  return NextResponse.json({ ok: true, wines: rows.length, synced: now })
}

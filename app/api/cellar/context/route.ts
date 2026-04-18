import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const CONTEXT_SECRET = process.env.CELLAR_CONTEXT_SECRET!

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${CONTEXT_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

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
      r.drink_from ? `drink ${r.drink_from}–${r.drink_until ?? '?'}` : null,
      r.my_rating ? `my rating: ${r.my_rating}/10` : null,
      r.notes ? `notes: ${r.notes}` : null,
    ].filter(Boolean).join(' · ')
    return `- ${parts}${extras ? ` (${extras})` : ''}`
  }

  const content = `# USER.md — About Justin

- **Name:** Justin
- **What to call them:** Justin
- **Timezone:** EST

## Wine Cellar
Last synced: ${now}

### In Cellar (${cellar.length} bottle${cellar.length !== 1 ? 's' : ''})
${cellar.length === 0 ? '_Empty_' : cellar.map(wineRow).join('\n')}

### Wines I've Had (${had.length})
${had.length === 0 ? '_None logged_' : had.map(wineRow).join('\n')}
`

  return new NextResponse(content, {
    headers: { 'Content-Type': 'text/plain' },
  })
}

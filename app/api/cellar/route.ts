import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL!
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!
const CELLAR_MD_PATH = '/home/openclaw/.openclaw/agents/wine/CELLAR.md'

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

async function ensureTable() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS wines (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      producer    TEXT,
      vintage     INTEGER,
      region      TEXT,
      country     TEXT,
      varietal    TEXT,
      score       INTEGER,
      estimated_retail_cost NUMERIC,
      drink_from  INTEGER,
      drink_until INTEGER,
      pairings    TEXT,
      notes       TEXT,
      added_date  TEXT,
      status      TEXT NOT NULL DEFAULT 'in_cellar',
      tasted      BOOLEAN DEFAULT FALSE,
      consumed_date TEXT,
      my_rating   INTEGER
    )
  `
}

function rowToWine(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    producer: row.producer ?? undefined,
    vintage: row.vintage ?? undefined,
    region: row.region ?? undefined,
    country: row.country ?? undefined,
    varietal: row.varietal ?? undefined,
    score: row.score ?? undefined,
    estimatedRetailCost: row.estimated_retail_cost ?? undefined,
    drinkFrom: row.drink_from ?? undefined,
    drinkUntil: row.drink_until ?? undefined,
    pairings: row.pairings ? JSON.parse(row.pairings as string) : undefined,
    notes: row.notes ?? undefined,
    addedDate: row.added_date ?? undefined,
    status: row.status as 'in_cellar' | 'consumed',
    tasted: row.tasted ?? undefined,
    consumedDate: row.consumed_date ?? undefined,
    myRating: row.my_rating ?? undefined,
  }
}

function buildCellarMarkdown(wines: ReturnType<typeof rowToWine>[]): string {
  const cellar = wines.filter(w => w.status === 'in_cellar')
  const had = wines.filter(w => w.status === 'consumed' || (w.status === 'in_cellar' && w.tasted))
  const now = new Date().toISOString().split('T')[0]

  const wineRow = (w: ReturnType<typeof rowToWine>) => {
    const parts = [w.name, w.producer, w.vintage, w.region, w.varietal].filter(Boolean).join(', ')
    const extras = [
      w.score ? `critic score: ${w.score}` : null,
      w.estimatedRetailCost ? `est. $${w.estimatedRetailCost}` : null,
      w.drinkFrom ? `drink ${w.drinkFrom}–${w.drinkUntil ?? '?'}` : null,
      w.myRating ? `my rating: ${w.myRating}/10` : null,
      w.notes ? `notes: ${w.notes}` : null,
    ].filter(Boolean).join(' · ')
    return `- ${parts}${extras ? ` (${extras})` : ''}`
  }

  return `# Justin's Wine Cellar
Last synced: ${now}

## In Cellar (${cellar.length} bottle${cellar.length !== 1 ? 's' : ''})
${cellar.length === 0 ? '_Empty_' : cellar.map(wineRow).join('\n')}

## Wines I've Had (${had.length})
${had.length === 0 ? '_None logged_' : had.map(wineRow).join('\n')}
`
}

async function syncToOpenClaw(wines: ReturnType<typeof rowToWine>[]) {
  try {
    const content = buildCellarMarkdown(wines)
    await fetch(`${GATEWAY}/api/workspace/file`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'vino', path: CELLAR_MD_PATH, action: 'write', content }),
      signal: AbortSignal.timeout(8000),
    })
  } catch (err) {
    console.warn('OpenClaw sync failed (non-fatal):', err)
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTable()
  const sql = getDb()
  const rows = await sql`SELECT * FROM wines ORDER BY added_date DESC`
  return NextResponse.json({ cellar: rows.map(rowToWine) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTable()
  const wine = await req.json()
  const sql = getDb()

  const id = `wine-${crypto.randomUUID().split('-')[0]}`
  const addedDate = new Date().toISOString().split('T')[0]
  const pairings = wine.pairings ? JSON.stringify(wine.pairings) : null

  await sql`
    INSERT INTO wines (
      id, name, producer, vintage, region, country, varietal,
      score, estimated_retail_cost, drink_from, drink_until,
      pairings, notes, added_date, status, tasted, consumed_date, my_rating
    ) VALUES (
      ${id}, ${wine.name}, ${wine.producer ?? null}, ${wine.vintage ?? null},
      ${wine.region ?? null}, ${wine.country ?? null}, ${wine.varietal ?? null},
      ${wine.score ?? null}, ${wine.estimatedRetailCost ?? null},
      ${wine.drinkFrom ?? null}, ${wine.drinkUntil ?? null},
      ${pairings}, ${wine.notes ?? null},
      ${addedDate}, ${wine.status ?? 'in_cellar'}, ${wine.tasted ?? false},
      ${wine.consumedDate ?? null}, ${wine.myRating ?? null}
    )
  `

  const newWine = { ...wine, id, addedDate, status: wine.status ?? 'in_cellar' }

  // Sync full cellar to OpenClaw workspace so Telegram bot stays in sync
  const allRows = await sql`SELECT * FROM wines ORDER BY added_date DESC`
  syncToOpenClaw(allRows.map(rowToWine)) // fire-and-forget, non-blocking

  return NextResponse.json(newWine)
}

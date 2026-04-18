import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL!
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!
const USER_MD_PATH = process.env.OPENCLAW_USER_MD_PATH || 'USER.md'

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
      my_rating   INTEGER,
      image_url   TEXT
    )
  `
  // Add image_url to existing tables that predate this column
  await sql`ALTER TABLE wines ADD COLUMN IF NOT EXISTS image_url TEXT`
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
    imageUrl: row.image_url ?? undefined,
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
    const res = await fetch(`${GATEWAY}/api/workspace/file`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'vino', path: USER_MD_PATH, action: 'write', content }),
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) {
      const text = await res.text()
      console.warn('OpenClaw sync HTTP error:', res.status, text)
    } else {
      console.log('OpenClaw sync ok:', res.status)
    }
  } catch (err) {
    console.warn('OpenClaw sync failed (non-fatal):', err)
  }
}

async function fetchAndStoreImage(sql: ReturnType<typeof getDb>, id: string, name: string, producer?: string, vintage?: number) {
  try {
    const params = new URLSearchParams({ name: name || '' })
    if (producer) params.set('producer', producer)
    if (vintage) params.set('vintage', String(vintage))
    const base = process.env.NEXTAUTH_URL || 'https://www.nd-ex.com'
    const res = await fetch(`${base}/api/wine-image?${params}`, { signal: AbortSignal.timeout(10000) })
    if (res.ok) {
      const { url } = await res.json()
      if (url) await sql`UPDATE wines SET image_url = ${url} WHERE id = ${id}`
    }
  } catch (err) {
    console.warn('Wine image fetch failed (non-fatal):', err)
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

  // Fetch wine image and sync to OpenClaw — both fire-and-forget
  const allRows = await sql`SELECT * FROM wines ORDER BY added_date DESC`
  syncToOpenClaw(allRows.map(rowToWine))
  fetchAndStoreImage(sql, id, wine.name, wine.producer, wine.vintage)

  return NextResponse.json(newWine)
}

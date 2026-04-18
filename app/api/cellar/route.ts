import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

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

  return NextResponse.json({ ...wine, id, addedDate, status: wine.status ?? 'in_cellar' })
}

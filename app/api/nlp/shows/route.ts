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
    CREATE TABLE IF NOT EXISTS nlp_shows (
      id           TEXT PRIMARY KEY,
      show_date    TEXT NOT NULL,
      artist_name  TEXT NOT NULL,
      genre        TEXT,
      description  TEXT,
      ticket_price NUMERIC,
      created_at   TEXT NOT NULL
    )
  `
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTable()
  const { searchParams } = new URL(req.url)
  const week = searchParams.get('week') // YYYY-MM-DD (Monday)
  const sql = getDb()

  let rows
  if (week) {
    const weekEnd = new Date(week + 'T12:00:00Z')
    weekEnd.setDate(weekEnd.getDate() + 6)
    const weekEndStr = weekEnd.toISOString().split('T')[0]
    rows = await sql`SELECT * FROM nlp_shows WHERE show_date >= ${week} AND show_date <= ${weekEndStr} ORDER BY show_date`
  } else {
    rows = await sql`SELECT * FROM nlp_shows ORDER BY show_date DESC LIMIT 200`
  }

  return NextResponse.json({ shows: rows })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTable()
  const sql = getDb()
  const body = await req.json()

  if (!body.showDate || !body.artistName) {
    return NextResponse.json({ error: 'showDate and artistName required' }, { status: 400 })
  }

  const id = `show-${crypto.randomUUID().split('-')[0]}`
  const createdAt = new Date().toISOString()

  await sql`
    INSERT INTO nlp_shows (id, show_date, artist_name, genre, description, ticket_price, created_at)
    VALUES (${id}, ${body.showDate}, ${body.artistName}, ${body.genre ?? null}, ${body.description ?? null}, ${body.ticketPrice ?? null}, ${createdAt})
    ON CONFLICT (id) DO NOTHING
  `

  return NextResponse.json({ id, showDate: body.showDate, artistName: body.artistName, genre: body.genre, createdAt })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sql = getDb()
  await sql`DELETE FROM nlp_shows WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

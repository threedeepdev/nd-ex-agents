import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

export async function GET(req: NextRequest) {
  const sql = neon(process.env.DATABASE_URL!)
  const today = new Date().toISOString().split('T')[0]
  const twoWeeksOut = new Date()
  twoWeeksOut.setDate(twoWeeksOut.getDate() + 14)
  const until = twoWeeksOut.toISOString().split('T')[0]

  const rows = await sql`
    SELECT show_date, artist_name, genre, description
    FROM nlp_shows
    WHERE show_date >= ${today} AND show_date <= ${until}
    ORDER BY show_date
  `

  return NextResponse.json({ shows: rows, fetchedAt: new Date().toISOString() })
}

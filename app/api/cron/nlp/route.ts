import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

function getMonday(offset = 7): string {
  const d = new Date()
  const day = d.getDay()
  const diff = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + diff - 7 + offset)
  return d.toISOString().split('T')[0]
}

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const nextMonday = getMonday(7)
  const sql = neon(process.env.DATABASE_URL!)

  const shows = await sql`
    SELECT show_date, artist_name FROM nlp_shows
    WHERE show_date >= ${nextMonday}
    AND show_date <= ${nextMonday.replace(/\d+$/, d => String(parseInt(d) + 6))}
    ORDER BY show_date
  `

  const base = process.env.NEXTAUTH_URL || 'https://www.nd-ex.com'
  // Pre-warm the poster so it's ready
  await fetch(`${base}/api/nlp/poster?week=${nextMonday}`, { signal: AbortSignal.timeout(15000) }).catch(() => {})

  return NextResponse.json({
    ok: true,
    week: nextMonday,
    showCount: shows.length,
    posterUrl: `${base}/api/nlp/poster?week=${nextMonday}`,
  })
}

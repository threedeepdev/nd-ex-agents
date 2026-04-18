import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { neon } from '@neondatabase/serverless'

export const runtime = 'edge'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']

function getMonday(dateStr?: string): Date {
  const base = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date()
  const day = base.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(base)
  mon.setUTCDate(mon.getUTCDate() + diff)
  return mon
}

function fmtDate(d: Date) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).toUpperCase()
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const monday = getMonday(searchParams.get('week') || undefined)

  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday)
    d.setUTCDate(d.getUTCDate() + i)
    return d
  })

  const weekStartStr = monday.toISOString().split('T')[0]
  const weekEndStr = weekDays[6].toISOString().split('T')[0]

  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`
    SELECT show_date, artist_name, genre FROM nlp_shows
    WHERE show_date >= ${weekStartStr} AND show_date <= ${weekEndStr}
    ORDER BY show_date
  `

  const byDate: Record<string, { artist: string; genre?: string }> = {}
  for (const r of rows) {
    byDate[r.show_date as string] = { artist: r.artist_name as string, genre: r.genre as string | undefined }
  }

  const weekLabel = `${fmtDate(monday)} – ${fmtDate(weekDays[6])}, ${monday.getUTCFullYear()}`

  return new ImageResponse(
    (
      <div
        style={{
          width: '1080px',
          height: '1080px',
          background: '#080808',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {/* Outer border */}
        <div style={{ position: 'absolute', inset: '18px', border: '1px solid rgba(255,255,255,0.12)', display: 'flex' }} />
        {/* Inner accent border top */}
        <div style={{ position: 'absolute', top: '28px', left: '28px', right: '28px', height: '1px', background: 'rgba(192,57,43,0.4)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: '28px', left: '28px', right: '28px', height: '1px', background: 'rgba(192,57,43,0.4)', display: 'flex' }} />

        {/* Content */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '860px', gap: '0px' }}>
          {/* Eyebrow */}
          <div style={{ fontSize: '13px', color: '#c0392b', letterSpacing: '0.4em', marginBottom: '18px', display: 'flex' }}>
            LIVE MUSIC
          </div>

          {/* Venue name */}
          <div style={{ fontSize: '80px', fontWeight: 700, color: 'white', letterSpacing: '-0.03em', lineHeight: '1', display: 'flex' }}>
            NIKKI LOPEZ
          </div>

          {/* Divider */}
          <div style={{ width: '48px', height: '2px', background: '#c0392b', margin: '22px 0 18px', display: 'flex' }} />

          {/* Week range */}
          <div style={{ fontSize: '15px', color: '#888', letterSpacing: '0.2em', marginBottom: '44px', display: 'flex' }}>
            {weekLabel}
          </div>

          {/* Schedule rows */}
          <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: '4px' }}>
            {weekDays.map((day, i) => {
              const ds = day.toISOString().split('T')[0]
              const show = byDate[ds]
              const num = day.getUTCDate()
              return (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '13px 20px',
                    background: show ? 'rgba(192,57,43,0.07)' : 'transparent',
                    borderRadius: '3px',
                    borderLeft: show ? '2px solid #c0392b' : '2px solid transparent',
                  }}
                >
                  <div style={{ width: '70px', fontSize: '12px', color: '#555', letterSpacing: '0.12em', display: 'flex' }}>
                    {DAYS[i]} {num}
                  </div>
                  <div style={{ width: '1px', height: '14px', background: '#2a2a2a', margin: '0 22px', display: 'flex' }} />
                  <div style={{
                    fontSize: show ? '24px' : '13px',
                    color: show ? 'white' : '#333',
                    fontWeight: show ? 600 : 400,
                    letterSpacing: show ? '-0.01em' : '0.08em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                  }}>
                    {show ? show.artist : '———'}
                    {show?.genre && (
                      <span style={{ fontSize: '11px', color: '#c0392b', letterSpacing: '0.1em', display: 'flex' }}>
                        {show.genre.toUpperCase()}
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}

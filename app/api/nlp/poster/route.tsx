import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { neon } from '@neondatabase/serverless'

const DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function getMonday(dateStr?: string): Date {
  const base = dateStr ? new Date(dateStr + 'T12:00:00Z') : new Date()
  const day = base.getUTCDay()
  const diff = day === 0 ? -6 : 1 - day
  const mon = new Date(base)
  mon.setUTCDate(mon.getUTCDate() + diff)
  return mon
}

function genreColor(genre?: string): string {
  if (!genre) return '#c0392b'
  const g = genre.toLowerCase()
  if (g.includes('metal') || g.includes('punk')) return '#e74c3c'
  if (g.includes('rock')) return '#e8643c'
  if (g.includes('electronic') || g.includes('dance') || g.includes('edm') || g.includes('techno')) return '#00bcd4'
  if (g.includes('hip') || g.includes('rap')) return '#f39c12'
  if (g.includes('r&b') || g.includes('soul') || g.includes('funk')) return '#ff9800'
  if (g.includes('alternative') || g.includes('indie')) return '#ab47bc'
  if (g.includes('jazz') || g.includes('blues')) return '#42a5f5'
  if (g.includes('country') || g.includes('folk')) return '#8bc34a'
  if (g.includes('pop')) return '#ec407a'
  return '#c0392b'
}

async function getSpotifyToken(): Promise<string | null> {
  try {
    const id = process.env.SPOTIFY_CLIENT_ID
    const secret = process.env.SPOTIFY_CLIENT_SECRET
    if (!id || !secret) return null
    const creds = Buffer.from(`${id}:${secret}`).toString('base64')
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { Authorization: `Basic ${creds}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(5000),
    })
    const data = await res.json()
    return data.access_token || null
  } catch { return null }
}

async function getArtistImage(token: string, rawName: string): Promise<string | null> {
  try {
    const primary = rawName.split(/[,·]/)[0].trim()
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(primary)}&type=artist&limit=1`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) }
    )
    const data = await res.json()
    const imgs = data.artists?.items?.[0]?.images
    return imgs?.[0]?.url || null
  } catch { return null }
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
    ORDER BY show_date, artist_name
  `

  type ShowEntry = { artists: string[]; genre?: string }
  const byDate: Record<string, ShowEntry> = {}
  for (const r of rows) {
    const date = r.show_date as string
    if (!byDate[date]) byDate[date] = { artists: [], genre: r.genre as string | undefined }
    byDate[date].artists.push(r.artist_name as string)
  }

  const showDays = weekDays.filter(d => byDate[d.toISOString().split('T')[0]])
  const showCount = showDays.length

  const spotifyToken = await getSpotifyToken()
  const images: Record<string, string | null> = {}
  if (spotifyToken) {
    await Promise.all(showDays.map(async d => {
      const ds = d.toISOString().split('T')[0]
      images[ds] = await getArtistImage(spotifyToken, byDate[ds].artists[0])
    }))
  }

  const weekLabel = `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${MONTHS[weekDays[6].getUTCMonth()]} ${weekDays[6].getUTCDate()}, ${monday.getUTCFullYear()}`

  const HEADER_H = 220
  const FOOTER_H = 56
  const BODY_H = 1080 - HEADER_H - FOOTER_H
  const rowH = showCount > 0 ? Math.floor(BODY_H / showCount) : BODY_H
  const imgSize = Math.min(rowH - 24, 180)

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1080, background: '#060606', display: 'flex', flexDirection: 'column' }}>

        {/* Corner marks */}
        {(['tl','tr','bl','br'] as const).map(pos => (
          <div key={pos} style={{
            position: 'absolute',
            top: pos.startsWith('t') ? 18 : undefined,
            bottom: pos.startsWith('b') ? 18 : undefined,
            left: pos.endsWith('l') ? 18 : undefined,
            right: pos.endsWith('r') ? 18 : undefined,
            width: 22, height: 22,
            borderTop: pos.startsWith('t') ? '1.5px solid rgba(192,57,43,0.45)' : undefined,
            borderBottom: pos.startsWith('b') ? '1.5px solid rgba(192,57,43,0.45)' : undefined,
            borderLeft: pos.endsWith('l') ? '1.5px solid rgba(192,57,43,0.45)' : undefined,
            borderRight: pos.endsWith('r') ? '1.5px solid rgba(192,57,43,0.45)' : undefined,
            display: 'flex',
          }} />
        ))}

        {/* HEADER */}
        <div style={{ height: HEADER_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.5em', marginBottom: 14, display: 'flex' }}>
            ◆ COMING UP AT ◆
          </div>
          <div style={{ fontSize: 86, fontWeight: 900, color: 'white', letterSpacing: '-0.03em', lineHeight: 1, display: 'flex' }}>
            NIKKI LOPEZ
          </div>
          <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.65em', marginTop: 8, display: 'flex' }}>
            P H I L L Y
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 20 }}>
            <div style={{ width: 28, height: 1, background: 'rgba(192,57,43,0.35)', display: 'flex' }} />
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.22em', padding: '0 14px', display: 'flex' }}>
              {weekLabel}
            </div>
            <div style={{ width: 28, height: 1, background: 'rgba(192,57,43,0.35)', display: 'flex' }} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.05)', display: 'flex' }} />

        {/* SHOW ROWS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {showCount === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'rgba(255,255,255,0.12)', letterSpacing: '0.3em' }}>
              NO SHOWS SCHEDULED
            </div>
          ) : weekDays.map((day) => {
            const ds = day.toISOString().split('T')[0]
            const show = byDate[ds]
            if (!show) return null

            const color = genreColor(show.genre)
            const img = images[ds]
            const artistLine = show.artists.join('  ·  ')
            const nameSize = artistLine.length > 50 ? 30 : artistLine.length > 35 ? 38 : artistLine.length > 22 ? 46 : 58
            const dayIdx = day.getUTCDay() === 0 ? 6 : day.getUTCDay() - 1

            return (
              <div key={ds} style={{ height: rowH, display: 'flex', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                {/* Color bar */}
                <div style={{ width: 5, height: rowH, background: color, flexShrink: 0, display: 'flex' }} />

                {/* Tinted bg strip */}
                <div style={{ position: 'absolute', left: 5, width: 400, height: rowH, background: color, opacity: 0.04, display: 'flex' }} />

                {/* Day */}
                <div style={{ width: 96, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, paddingLeft: 18 }}>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.28)', letterSpacing: '0.2em', display: 'flex' }}>{DAYS[dayIdx]}</div>
                  <div style={{ fontSize: 44, fontWeight: 900, color: 'rgba(255,255,255,0.88)', lineHeight: 1, display: 'flex' }}>{day.getUTCDate()}</div>
                  <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.15em', display: 'flex' }}>{MONTHS[day.getUTCMonth()]}</div>
                </div>

                {/* Rule */}
                <div style={{ width: 1, height: rowH * 0.5, background: 'rgba(255,255,255,0.06)', marginLeft: 16, flexShrink: 0, display: 'flex' }} />

                {/* Artist info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 26, paddingRight: 20 }}>
                  <div style={{ fontSize: nameSize, fontWeight: 900, color: 'white', letterSpacing: '-0.015em', lineHeight: 1.08, display: 'flex', flexWrap: 'wrap' }}>
                    {artistLine}
                  </div>
                  {show.genre && (
                    <div style={{ display: 'flex', marginTop: 10 }}>
                      <div style={{ fontSize: 10, color: color, letterSpacing: '0.22em', padding: '3px 10px', border: `1px solid ${color}55`, borderRadius: 2, display: 'flex' }}>
                        {show.genre.toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Artist photo */}
                {img && (
                  <div style={{ width: imgSize, height: imgSize, borderRadius: 6, overflow: 'hidden', flexShrink: 0, marginRight: 36, display: 'flex' }}>
                    <img src={img} width={imgSize} height={imgSize} style={{ width: imgSize, height: imgSize, objectFit: 'cover' }} alt="" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* FOOTER */}
        <div style={{ height: FOOTER_H, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.18)', letterSpacing: '0.35em', display: 'flex' }}>
            NIKKITLOPEZPHILLY.COM
          </div>
        </div>
      </div>
    ),
    { width: 1080, height: 1080 }
  )
}

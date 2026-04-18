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
  if (g.includes('metal') || g.includes('punk') || g.includes('hard rock')) return '#e74c3c'
  if (g.includes('rock')) return '#e8643c'
  if (g.includes('electronic') || g.includes('dance') || g.includes('edm') || g.includes('techno')) return '#00bcd4'
  if (g.includes('hip') || g.includes('rap')) return '#f39c12'
  if (g.includes('r&b') || g.includes('soul') || g.includes('funk')) return '#ff9800'
  if (g.includes('alternative') || g.includes('indie')) return '#ab47bc'
  if (g.includes('jazz') || g.includes('blues')) return '#42a5f5'
  if (g.includes('country') || g.includes('folk')) return '#8bc34a'
  if (g.includes('pop')) return '#ec407a'
  if (g.includes('classical') || g.includes('orchestral')) return '#78909c'
  if (g.includes('reggae') || g.includes('ska')) return '#66bb6a'
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

  // Fetch Spotify images for each show day's primary artist
  const spotifyToken = await getSpotifyToken()
  const images: Record<string, string | null> = {}
  if (spotifyToken) {
    await Promise.all(showDays.map(async d => {
      const ds = d.toISOString().split('T')[0]
      const show = byDate[ds]
      images[ds] = await getArtistImage(spotifyToken, show.artists[0])
    }))
  }

  const weekRangeLabel = `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${MONTHS[weekDays[6].getUTCMonth()]} ${weekDays[6].getUTCDate()}, ${monday.getUTCFullYear()}`
  const showCount = showDays.length

  // Load condensed bold font
  let fontData: ArrayBuffer | null = null
  try {
    const fontRes = await fetch('https://fonts.gstatic.com/s/barlowcondensed/v12/HTxwL3I-JCGChYJ8VI-L6OO_au7B6xTru1H2lg.woff2', { signal: AbortSignal.timeout(4000) })
    fontData = fontRes.ok ? await fontRes.arrayBuffer() : null
  } catch { fontData = null }

  const POSTER_H = 1080
  const HEADER_H = 220
  const FOOTER_H = 60
  const BODY_H = POSTER_H - HEADER_H - FOOTER_H
  const rowH = showCount > 0 ? Math.floor(BODY_H / showCount) : BODY_H

  const fontOptions = fontData ? [{
    name: 'BarlowCondensed',
    data: fontData,
    style: 'normal' as const,
    weight: 700 as const,
  }] : []

  return new ImageResponse(
    (
      <div style={{ width: 1080, height: 1080, background: '#060606', display: 'flex', flexDirection: 'column', position: 'relative', fontFamily: fontData ? 'BarlowCondensed, sans-serif' : 'sans-serif' }}>

        {/* Decorative corner marks */}
        <div style={{ position: 'absolute', top: 20, left: 20, width: 24, height: 24, borderTop: '1.5px solid rgba(192,57,43,0.5)', borderLeft: '1.5px solid rgba(192,57,43,0.5)', display: 'flex' }} />
        <div style={{ position: 'absolute', top: 20, right: 20, width: 24, height: 24, borderTop: '1.5px solid rgba(192,57,43,0.5)', borderRight: '1.5px solid rgba(192,57,43,0.5)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: 20, left: 20, width: 24, height: 24, borderBottom: '1.5px solid rgba(192,57,43,0.5)', borderLeft: '1.5px solid rgba(192,57,43,0.5)', display: 'flex' }} />
        <div style={{ position: 'absolute', bottom: 20, right: 20, width: 24, height: 24, borderBottom: '1.5px solid rgba(192,57,43,0.5)', borderRight: '1.5px solid rgba(192,57,43,0.5)', display: 'flex' }} />

        {/* HEADER */}
        <div style={{ height: HEADER_H, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 60px' }}>
          <div style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.5em', marginBottom: 16, display: 'flex' }}>COMING UP AT</div>
          <div style={{ fontSize: 82, fontWeight: 900, color: 'white', letterSpacing: '-0.02em', lineHeight: 1, display: 'flex', textTransform: 'uppercase' }}>
            NIKKI LOPEZ
          </div>
          <div style={{ fontSize: 18, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.6em', marginTop: 6, display: 'flex' }}>
            P H I L L Y
          </div>
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 18, gap: 0 }}>
            <div style={{ width: 32, height: 1, background: 'rgba(192,57,43,0.4)', display: 'flex' }} />
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.25em', padding: '0 14px', display: 'flex' }}>{weekRangeLabel}</div>
            <div style={{ width: 32, height: 1, background: 'rgba(192,57,43,0.4)', display: 'flex' }} />
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: 1, background: 'rgba(255,255,255,0.06)', display: 'flex' }} />

        {/* SHOW ROWS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {showCount === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, color: 'rgba(255,255,255,0.15)', letterSpacing: '0.2em' }}>
              NO SHOWS SCHEDULED
            </div>
          ) : weekDays.map((day, i) => {
            const ds = day.toISOString().split('T')[0]
            const show = byDate[ds]
            if (!show) return null

            const color = genreColor(show.genre)
            const img = images[ds]
            const artistLine = show.artists.join('  ·  ')
            const nameSize = artistLine.length > 45 ? 32 : artistLine.length > 30 ? 40 : artistLine.length > 20 ? 48 : 58
            const dayIdx = day.getUTCDay() === 0 ? 6 : day.getUTCDay() - 1

            return (
              <div
                key={ds}
                style={{
                  height: rowH,
                  display: 'flex',
                  alignItems: 'center',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Genre color left bar */}
                <div style={{ width: 5, height: '100%', background: color, flexShrink: 0, display: 'flex' }} />

                {/* Subtle bg glow */}
                <div style={{ position: 'absolute', left: 0, top: 0, width: '60%', height: '100%', background: `linear-gradient(90deg, ${color}12 0%, transparent 100%)`, display: 'flex' }} />

                {/* Day label */}
                <div style={{ width: 100, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0, paddingLeft: 24 }}>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.18em', display: 'flex' }}>{DAYS[dayIdx]}</div>
                  <div style={{ fontSize: 46, fontWeight: 900, color: 'rgba(255,255,255,0.9)', lineHeight: 1, display: 'flex' }}>{day.getUTCDate()}</div>
                  <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.12em', display: 'flex' }}>{MONTHS[day.getUTCMonth()]}</div>
                </div>

                {/* Vertical divider */}
                <div style={{ width: 1, height: '55%', background: 'rgba(255,255,255,0.07)', flexShrink: 0, marginLeft: 20, display: 'flex' }} />

                {/* Artist info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 28, paddingRight: 20 }}>
                  <div style={{ fontSize: nameSize, fontWeight: 900, color: 'white', letterSpacing: '-0.01em', lineHeight: 1.05, display: 'flex', flexWrap: 'wrap' }}>
                    {artistLine}
                  </div>
                  {show.genre && (
                    <div style={{ display: 'flex', marginTop: 8 }}>
                      <div style={{ fontSize: 10, color: color, letterSpacing: '0.25em', background: `${color}18`, padding: '3px 10px', borderRadius: 2, display: 'flex' }}>
                        {show.genre.toUpperCase()}
                      </div>
                    </div>
                  )}
                </div>

                {/* Artist image */}
                {img && (
                  <div style={{ width: rowH - 32, height: rowH - 32, flexShrink: 0, marginRight: 32, borderRadius: 8, overflow: 'hidden', display: 'flex', position: 'relative' }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={img} width={rowH - 32} height={rowH - 32} style={{ objectFit: 'cover', width: rowH - 32, height: rowH - 32 }} alt="" />
                    {/* Fade overlay */}
                    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, rgba(6,6,6,0.5) 0%, transparent 40%)', display: 'flex' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* FOOTER */}
        <div style={{ height: FOOTER_H, display: 'flex', alignItems: 'center', justifyContent: 'center', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.3em', display: 'flex' }}>
            NIKKITLOPEZPHILLY.COM
          </div>
        </div>
      </div>
    ),
    {
      width: 1080,
      height: 1080,
      fonts: fontOptions,
    }
  )
}

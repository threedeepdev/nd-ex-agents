import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getLiveShows } from '@/lib/nlp-scrape'

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
  if (g.includes('metal') || g.includes('punk')) return '#c0392b'
  if (g.includes('rock')) return '#b03a2e'
  if (g.includes('electronic') || g.includes('dance') || g.includes('edm')) return '#0077aa'
  if (g.includes('hip') || g.includes('rap')) return '#b07d00'
  if (g.includes('r&b') || g.includes('soul')) return '#a04000'
  if (g.includes('alternative') || g.includes('indie')) return '#7b2d8b'
  if (g.includes('jazz') || g.includes('blues')) return '#1565c0'
  if (g.includes('country') || g.includes('folk')) return '#4a7c2f'
  if (g.includes('pop')) return '#ad1457'
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

async function getArtistImageBase64(token: string, rawName: string): Promise<string | null> {
  try {
    const primary = rawName.split(/[,·]/)[0].trim()
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(primary)}&type=artist&limit=1`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()
    const imgUrl = data.artists?.items?.[0]?.images?.[0]?.url
    if (!imgUrl) return null
    // Fetch and convert to base64 — Satori cannot load external URLs
    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(5000) })
    if (!imgRes.ok) return null
    const buf = await imgRes.arrayBuffer()
    return `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`
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

  // Fetch live show data from Ticketmaster + Scenic NYC
  const allShows = await getLiveShows()
  const weekShows = allShows.filter(s => s.showDate >= weekStartStr && s.showDate <= weekEndStr)

  // Group by date, supporting multiple shows per day
  type ShowEntry = { artists: string[]; genre?: string; description?: string }
  const byDate: Record<string, ShowEntry> = {}
  for (const s of weekShows) {
    if (!byDate[s.showDate]) byDate[s.showDate] = { artists: [], genre: s.genre, description: s.description }
    byDate[s.showDate].artists.push(s.artistName)
    if (!byDate[s.showDate].genre && s.genre) byDate[s.showDate].genre = s.genre
    if (!byDate[s.showDate].description && s.description) byDate[s.showDate].description = s.description
  }

  const showDays = weekDays.filter(d => byDate[d.toISOString().split('T')[0]])
  const showCount = showDays.length

  // Fetch Spotify artist photos as base64 (Satori requires base64, not external URLs)
  const spotifyToken = await getSpotifyToken()
  const images: Record<string, string | null> = {}
  if (spotifyToken && showCount > 0) {
    await Promise.all(showDays.map(async d => {
      const ds = d.toISOString().split('T')[0]
      images[ds] = await getArtistImageBase64(spotifyToken, byDate[ds].artists[0])
    }))
  }

  const weekLabel = `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${MONTHS[weekDays[6].getUTCMonth()]} ${weekDays[6].getUTCDate()}, ${monday.getUTCFullYear()}`

  // Load venue logo as base64
  const base = process.env.NEXTAUTH_URL || 'https://www.nd-ex.com'
  let logoData: string | null = null
  try {
    const logoRes = await fetch(`${base}/nlp-logo.png`, { signal: AbortSignal.timeout(3000) })
    if (logoRes.ok) {
      const buf = await logoRes.arrayBuffer()
      logoData = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
    }
  } catch { /* no logo, use text fallback */ }

  // Layout
  const W = 1080
  const H = 1080
  const HEADER_H = 220
  const FOOTER_H = 60
  const BODY_H = H - HEADER_H - FOOTER_H
  const rowH = showCount > 0 ? Math.floor(BODY_H / showCount) : BODY_H
  const imgW = 180
  const imgH = Math.min(rowH - 16, 180)

  type ShowRow = { ds: string; day: Date; show: ShowEntry; dayIdx: number; color: string; img: string | null }
  const showRows = weekDays
    .map(day => {
      const ds = day.toISOString().split('T')[0]
      const show = byDate[ds]
      if (!show) return null
      const dayIdx = day.getUTCDay() === 0 ? 6 : day.getUTCDay() - 1
      return { ds, day, show, dayIdx, color: genreColor(show.genre), img: images[ds] || null }
    })
    .filter((x): x is ShowRow => x !== null)

  // Cream concert poster — high contrast, readable at thumbnail size
  const BG = '#f5f0e8'
  const INK = '#1a1210'
  const MUTED = '#6b5d52'
  const RULE_COLOR = '#c8bdb0'

  return new ImageResponse(
    (
      <div style={{ width: W, height: H, background: BG, display: 'flex', flexDirection: 'column' }}>

        {/* HEADER */}
        <div style={{
          height: HEADER_H,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: `3px solid ${INK}`,
        }}>
          {logoData ? (
            <img src={logoData} width={340} height={130} style={{ width: 340, height: 130, objectFit: 'contain' }} alt="" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 11, color: '#c0392b', letterSpacing: '0.5em', marginBottom: 10, display: 'flex' }}>
                ◆  LIVE MUSIC AT  ◆
              </div>
              <div style={{ fontSize: 74, fontWeight: 900, color: INK, letterSpacing: '-0.03em', lineHeight: 1, display: 'flex' }}>
                NIKKI LOPEZ
              </div>
              <div style={{ fontSize: 12, color: MUTED, letterSpacing: '0.6em', marginTop: 6, display: 'flex' }}>
                SOUTH STREET  ·  PHILADELPHIA
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 18 }}>
            <div style={{ width: 40, height: 1, background: MUTED, display: 'flex' }} />
            <div style={{ fontSize: 11, color: MUTED, letterSpacing: '0.25em', padding: '0 16px', display: 'flex' }}>
              {weekLabel}
            </div>
            <div style={{ width: 40, height: 1, background: MUTED, display: 'flex' }} />
          </div>
        </div>

        {/* SHOW ROWS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {showCount === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 22, color: MUTED, letterSpacing: '0.3em', display: 'flex' }}>NO SHOWS THIS WEEK</div>
            </div>
          ) : showRows.map(({ ds, show, day, dayIdx, color, img }, idx) => {
            const artistLine = show.artists.join('  ·  ')
            const nameSize = artistLine.length > 50 ? 28 : artistLine.length > 35 ? 36 : artistLine.length > 22 ? 44 : 54
            const isLast = idx === showRows.length - 1

            return (
              <div
                key={ds}
                style={{
                  height: rowH,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  borderBottom: isLast ? 'none' : `1px solid ${INK}`,
                  background: BG,
                }}
              >
                {/* Genre color bar */}
                <div style={{ width: 6, height: rowH, background: color, flexShrink: 0, display: 'flex' }} />

                {/* Day block */}
                <div style={{
                  width: 100,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  paddingLeft: 16,
                  paddingRight: 8,
                }}>
                  <div style={{ fontSize: 10, color: MUTED, letterSpacing: '0.2em', display: 'flex' }}>{DAYS[dayIdx]}</div>
                  <div style={{ fontSize: 46, fontWeight: 900, color: INK, lineHeight: 1, display: 'flex' }}>{day.getUTCDate()}</div>
                  <div style={{ fontSize: 9, color: MUTED, letterSpacing: '0.2em', display: 'flex' }}>{MONTHS[day.getUTCMonth()]}</div>
                </div>

                {/* Vertical rule */}
                <div style={{ width: 1, height: rowH * 0.5, background: RULE_COLOR, flexShrink: 0, display: 'flex' }} />

                {/* Artist + genre */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 28, paddingRight: 20 }}>
                  <div style={{ fontSize: nameSize, fontWeight: 900, color: INK, letterSpacing: '-0.01em', lineHeight: 1.1, display: 'flex' }}>
                    {artistLine}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 8 }}>
                    {show.genre && (
                      <div style={{
                        fontSize: 9,
                        color: color,
                        letterSpacing: '0.25em',
                        padding: '3px 10px',
                        border: `1.5px solid ${color}`,
                        borderRadius: 2,
                        display: 'flex',
                        marginRight: 14,
                      }}>
                        {show.genre.toUpperCase()}
                      </div>
                    )}
                    {show.description && rowH > 120 && (
                      <div style={{ fontSize: 11, color: MUTED, display: 'flex', overflow: 'hidden' }}>
                        {show.description.slice(0, 80)}{show.description.length > 80 ? '…' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Spotify artist photo */}
                {img && (
                  <div style={{ width: imgW, height: imgH, marginRight: 28, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
                    <img src={img} width={imgW} height={imgH} alt="" style={{ width: imgW, height: imgH, objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* FOOTER */}
        <div style={{
          height: FOOTER_H,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderTop: `3px solid ${INK}`,
          background: INK,
        }}>
          <div style={{ fontSize: 11, color: BG, letterSpacing: '0.45em', display: 'flex' }}>
            NIKKITLOPEZPHILLY.COM
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}

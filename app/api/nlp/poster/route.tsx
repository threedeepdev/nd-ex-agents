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
  if (!genre) return '#e53935'
  const g = genre.toLowerCase()
  if (g.includes('metal') || g.includes('punk')) return '#e53935'
  if (g.includes('rock')) return '#ff6d3a'
  if (g.includes('electronic') || g.includes('dance') || g.includes('edm')) return '#00b0d8'
  if (g.includes('hip') || g.includes('rap')) return '#ffd600'
  if (g.includes('r&b') || g.includes('soul')) return '#ff9800'
  if (g.includes('alternative') || g.includes('indie')) return '#ce93d8'
  if (g.includes('jazz') || g.includes('blues')) return '#64b5f6'
  if (g.includes('country') || g.includes('folk')) return '#a5d6a7'
  if (g.includes('pop')) return '#f48fb1'
  return '#e53935'
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

  const allShows = await getLiveShows()
  const weekShows = allShows.filter(s => s.showDate >= weekStartStr && s.showDate <= weekEndStr)

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

  const spotifyToken = await getSpotifyToken()
  const images: Record<string, string | null> = {}
  if (spotifyToken && showCount > 0) {
    await Promise.all(showDays.map(async d => {
      const ds = d.toISOString().split('T')[0]
      images[ds] = await getArtistImageBase64(spotifyToken, byDate[ds].artists[0])
    }))
  }

  const weekLabel = `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${MONTHS[weekDays[6].getUTCMonth()]} ${weekDays[6].getUTCDate()}, ${monday.getUTCFullYear()}`

  const base = process.env.NEXTAUTH_URL || 'https://www.nd-ex.com'
  let logoData: string | null = null
  try {
    const logoRes = await fetch(`${base}/nlp-logo.png`, { signal: AbortSignal.timeout(3000) })
    if (logoRes.ok) {
      const buf = await logoRes.arrayBuffer()
      logoData = `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
    }
  } catch { /* text fallback */ }

  const W = 1080
  const H = 1080
  const HEADER_H = 200
  const FOOTER_H = 56
  const BODY_H = H - HEADER_H - FOOTER_H
  const rowH = showCount > 0 ? Math.floor(BODY_H / showCount) : BODY_H
  const imgSize = Math.min(rowH - 12, 150)

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

  // Dark poster — true black bg, bright whites, vivid color accents
  const BG = '#0a0a0a'
  const ROW_BG = '#111111'
  const BORDER = '#222222'
  const WHITE = '#ffffff'
  const DIM = '#888888'

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
          borderBottom: `1px solid ${BORDER}`,
        }}>
          {logoData ? (
            <img src={logoData} width={300} height={110} style={{ width: 300, height: 110, objectFit: 'contain' }} alt="" />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ fontSize: 10, color: '#e53935', letterSpacing: '0.6em', marginBottom: 12, display: 'flex' }}>
                ◆  COMING UP AT  ◆
              </div>
              <div style={{ fontSize: 80, fontWeight: 900, color: WHITE, letterSpacing: '-0.03em', lineHeight: 1, display: 'flex' }}>
                NIKKI LOPEZ
              </div>
              <div style={{ fontSize: 11, color: DIM, letterSpacing: '0.6em', marginTop: 8, display: 'flex' }}>
                SOUTH STREET  ·  PHILADELPHIA
              </div>
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', marginTop: 20 }}>
            <div style={{ width: 32, height: 1, background: '#333', display: 'flex' }} />
            <div style={{ fontSize: 11, color: DIM, letterSpacing: '0.28em', padding: '0 16px', display: 'flex' }}>
              {weekLabel}
            </div>
            <div style={{ width: 32, height: 1, background: '#333', display: 'flex' }} />
          </div>
        </div>

        {/* SHOW ROWS */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          {showCount === 0 ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ fontSize: 20, color: '#333', letterSpacing: '0.35em', display: 'flex' }}>NO SHOWS SCHEDULED</div>
            </div>
          ) : showRows.map(({ ds, show, day, dayIdx, color, img }, idx) => {
            const artistLine = show.artists.join('  ·  ')
            const nameSize = artistLine.length > 50 ? 30 : artistLine.length > 35 ? 40 : artistLine.length > 22 ? 50 : 62
            const hasDesc = !!show.description
            const isLast = idx === showRows.length - 1

            return (
              <div
                key={ds}
                style={{
                  height: rowH,
                  display: 'flex',
                  flexDirection: 'row',
                  alignItems: 'center',
                  background: idx % 2 === 0 ? BG : ROW_BG,
                  borderBottom: isLast ? 'none' : `1px solid ${BORDER}`,
                }}
              >
                {/* Color accent bar — full height, wide */}
                <div style={{ width: 8, height: rowH, background: color, flexShrink: 0, display: 'flex' }} />

                {/* Day block */}
                <div style={{
                  width: 110,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <div style={{ fontSize: 11, color: DIM, letterSpacing: '0.2em', display: 'flex' }}>{DAYS[dayIdx]}</div>
                  <div style={{ fontSize: 52, fontWeight: 900, color: WHITE, lineHeight: 1, display: 'flex' }}>{day.getUTCDate()}</div>
                  <div style={{ fontSize: 10, color: DIM, letterSpacing: '0.2em', display: 'flex' }}>{MONTHS[day.getUTCMonth()]}</div>
                </div>

                {/* Vertical rule */}
                <div style={{ width: 1, height: rowH * 0.55, background: '#2a2a2a', flexShrink: 0, display: 'flex' }} />

                {/* Artist info */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 28, paddingRight: 16 }}>
                  <div style={{ fontSize: nameSize, fontWeight: 900, color: WHITE, letterSpacing: '-0.01em', lineHeight: 1.1, display: 'flex' }}>
                    {artistLine}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 10, flexWrap: 'nowrap' }}>
                    {show.genre && (
                      <div style={{
                        fontSize: 10,
                        color: color,
                        letterSpacing: '0.28em',
                        padding: '4px 12px',
                        border: `1px solid ${color}`,
                        borderRadius: 2,
                        display: 'flex',
                        marginRight: 14,
                        flexShrink: 0,
                      }}>
                        {show.genre.toUpperCase()}
                      </div>
                    )}
                    {hasDesc && rowH >= 90 && (
                      <div style={{ fontSize: 12, color: '#666', display: 'flex', overflow: 'hidden' }}>
                        {show.description!.slice(0, 70)}{show.description!.length > 70 ? '…' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Spotify artist photo */}
                {img && (
                  <div style={{ width: imgSize, height: imgSize, marginRight: 24, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
                    <img src={img} width={imgSize} height={imgSize} alt="" style={{ width: imgSize, height: imgSize, objectFit: 'cover' }} />
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
          borderTop: `1px solid ${BORDER}`,
        }}>
          <div style={{ fontSize: 10, color: '#444', letterSpacing: '0.45em', display: 'flex' }}>
            NIKKITLOPEZPHILLY.COM
          </div>
        </div>
      </div>
    ),
    { width: W, height: H, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}

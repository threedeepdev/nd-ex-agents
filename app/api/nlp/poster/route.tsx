import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getLiveShows } from '@/lib/nlp-scrape'
import { readFileSync } from 'fs'
import { join } from 'path'

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

function spotifyGenreToDisplay(genres: string[]): string | null {
  if (!genres.length) return null
  // Map Spotify's free-form genre tags to clean display labels
  const joined = genres.join(' ').toLowerCase()
  if (joined.includes('metal') || joined.includes('hardcore') || joined.includes('punk')) return 'Metal / Punk'
  if (joined.includes('hard rock') || joined.includes('classic rock') || joined.includes('rock')) return 'Rock'
  if (joined.includes('edm') || joined.includes('electronic') || joined.includes('dance') || joined.includes('house') || joined.includes('techno') || joined.includes('trance')) return 'Electronic'
  if (joined.includes('hip hop') || joined.includes('hip-hop') || joined.includes('rap') || joined.includes('trap')) return 'Hip-Hop'
  if (joined.includes('r&b') || joined.includes('soul') || joined.includes('funk')) return 'R&B / Soul'
  if (joined.includes('indie') || joined.includes('alternative') || joined.includes('alt-')) return 'Alternative'
  if (joined.includes('jazz') || joined.includes('blues')) return 'Jazz / Blues'
  if (joined.includes('country') || joined.includes('folk') || joined.includes('americana')) return 'Country / Folk'
  if (joined.includes('pop')) return 'Pop'
  if (joined.includes('reggae') || joined.includes('ska')) return 'Reggae'
  if (joined.includes('classical') || joined.includes('orchestral')) return 'Classical'
  // Return the first Spotify genre tag cleaned up as fallback
  return genres[0].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function genreColor(genre?: string): string {
  if (!genre) return '#e53935'
  const g = genre.toLowerCase()
  if (g.includes('metal') || g.includes('punk') || g.includes('hardcore')) return '#e53935'
  if (g.includes('rock')) return '#ff6d3a'
  if (g.includes('electronic') || g.includes('dance') || g.includes('edm') || g.includes('house')) return '#00b0d8'
  if (g.includes('hip') || g.includes('rap') || g.includes('trap')) return '#ffd600'
  if (g.includes('r&b') || g.includes('soul') || g.includes('funk')) return '#ff9800'
  if (g.includes('alternative') || g.includes('indie') || g.includes('alt')) return '#ce93d8'
  if (g.includes('jazz') || g.includes('blues')) return '#64b5f6'
  if (g.includes('country') || g.includes('folk') || g.includes('americana')) return '#a5d6a7'
  if (g.includes('pop')) return '#f48fb1'
  if (g.includes('reggae') || g.includes('ska')) return '#80cbc4'
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

type ArtistData = { imageBase64: string | null; genres: string[] }

async function getArtistData(token: string, rawName: string): Promise<ArtistData> {
  try {
    // Search each individual act — use the headliner (first name before comma/·)
    const primary = rawName.split(/[,·]/)[0].trim()
    const res = await fetch(
      `https://api.spotify.com/v1/search?q=${encodeURIComponent(primary)}&type=artist&limit=1`,
      { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) }
    )
    const data = await res.json()
    const artist = data.artists?.items?.[0]
    if (!artist) return { imageBase64: null, genres: [] }

    const genres: string[] = artist.genres || []

    // Use medium-sized image (index 1 = ~300px) to keep base64 manageable
    const imgs: { url: string }[] = artist.images || []
    const imgUrl = imgs[1]?.url || imgs[0]?.url || null
    if (!imgUrl) return { imageBase64: null, genres }

    const imgRes = await fetch(imgUrl, { signal: AbortSignal.timeout(6000) })
    if (!imgRes.ok) return { imageBase64: null, genres }
    const buf = await imgRes.arrayBuffer()
    const imageBase64 = `data:image/jpeg;base64,${Buffer.from(buf).toString('base64')}`
    return { imageBase64, genres }
  } catch {
    return { imageBase64: null, genres: [] }
  }
}

// When Ticketmaster says "Other", search every individual artist on the bill
// and return the first real genre found across all of them
async function resolveGenre(token: string, artistLine: string, tmGenre?: string): Promise<string | undefined> {
  const isOther = !tmGenre || tmGenre.toLowerCase() === 'other' || tmGenre.toLowerCase() === 'undefined'
  if (!isOther) return tmGenre

  const acts = artistLine.split(/[,·]/).map(a => a.trim()).filter(Boolean)
  for (const act of acts) {
    try {
      const res = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(act)}&type=artist&limit=1`,
        { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(4000) }
      )
      const data = await res.json()
      const genres: string[] = data.artists?.items?.[0]?.genres || []
      const mapped = spotifyGenreToDisplay(genres)
      if (mapped) return mapped
    } catch { /* try next act */ }
  }
  return undefined
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

  // Fetch artist images AND resolve "Other" genres in parallel
  const artistDataMap: Record<string, ArtistData> = {}
  if (spotifyToken && showCount > 0) {
    await Promise.all(showDays.map(async d => {
      const ds = d.toISOString().split('T')[0]
      const show = byDate[ds]
      const [artistData, resolvedGenre] = await Promise.all([
        getArtistData(spotifyToken, show.artists[0]),
        resolveGenre(spotifyToken, show.artists.join(', '), show.genre),
      ])
      artistDataMap[ds] = artistData
      // Overwrite genre if we got a better one
      if (resolvedGenre) byDate[ds].genre = resolvedGenre
    }))
  }

  const weekLabel = `${MONTHS[monday.getUTCMonth()]} ${monday.getUTCDate()} – ${MONTHS[weekDays[6].getUTCMonth()]} ${weekDays[6].getUTCDate()}, ${monday.getUTCFullYear()}`

  let logoData: string | null = null
  try {
    const logoBuf = readFileSync(join(process.cwd(), 'public', 'nlp-logo.png'))
    logoData = `data:image/png;base64,${logoBuf.toString('base64')}`
  } catch { /* text fallback */ }

  const W = 1080
  const H = 1080
  const HEADER_H = 200
  const BODY_H = H - HEADER_H
  const rowH = showCount > 0 ? Math.floor(BODY_H / showCount) : BODY_H
  const imgSize = Math.min(rowH - 12, 150)

  type ShowRow = { ds: string; day: Date; show: ShowEntry; dayIdx: number; color: string; img: string | null }
  const showRows = weekDays
    .map(day => {
      const ds = day.toISOString().split('T')[0]
      const show = byDate[ds]
      if (!show) return null
      const dayIdx = day.getUTCDay() === 0 ? 6 : day.getUTCDay() - 1
      return {
        ds, day, show, dayIdx,
        color: genreColor(show.genre),
        img: artistDataMap[ds]?.imageBase64 || null,
      }
    })
    .filter((x): x is ShowRow => x !== null)

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
                {/* Color accent bar */}
                <div style={{ width: 8, height: rowH, background: color, flexShrink: 0, display: 'flex' }} />

                {/* Day */}
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

                {/* Divider */}
                <div style={{ width: 1, height: rowH * 0.55, background: '#2a2a2a', flexShrink: 0, display: 'flex' }} />

                {/* Artist + genre + description */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: 28, paddingRight: 16 }}>
                  <div style={{ fontSize: nameSize, fontWeight: 900, color: WHITE, letterSpacing: '-0.01em', lineHeight: 1.1, display: 'flex' }}>
                    {artistLine}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', marginTop: 10 }}>
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
                    {show.description && rowH >= 90 && (
                      <div style={{ fontSize: 12, color: '#666', display: 'flex', overflow: 'hidden' }}>
                        {show.description.slice(0, 70)}{show.description.length > 70 ? '…' : ''}
                      </div>
                    )}
                  </div>
                </div>

                {/* Artist photo */}
                {img && (
                  <div style={{ width: imgSize, height: imgSize, marginRight: 24, flexShrink: 0, display: 'flex', overflow: 'hidden' }}>
                    <img src={img} width={imgSize} height={imgSize} alt="" style={{ width: imgSize, height: imgSize, objectFit: 'cover' }} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    ),
    { width: W, height: H, headers: { 'Cache-Control': 'no-store, no-cache, must-revalidate' } }
  )
}

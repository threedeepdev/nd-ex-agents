import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

type ScrapedShow = {
  showDate: string
  artistName: string
  genre?: string
  description?: string
  ticketUrl?: string
}

async function scrapeTicketmaster(): Promise<ScrapedShow[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY
  if (!apiKey) return []

  const url = `https://app.ticketmaster.com/discovery/v2/events.json?keyword=nikki+lopez&apikey=${apiKey}&size=50&sort=date,asc`
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
  if (!res.ok) return []

  const data = await res.json()
  const events = data?._embedded?.events ?? []

  return events.map((ev: Record<string, unknown>) => {
    const dates = ev.dates as Record<string, unknown>
    const start = dates?.start as Record<string, unknown>
    const localDate = start?.localDate as string | undefined
    const name = ev.name as string
    const classifications = (ev.classifications as Record<string, unknown>[])?.[0]
    const genre = (classifications?.genre as Record<string, string>)?.name
    const ticketUrl = ev.url as string | undefined
    return {
      showDate: localDate || '',
      artistName: name,
      genre: genre && genre !== 'Undefined' ? genre : undefined,
      ticketUrl,
    }
  }).filter((s: ScrapedShow) => s.showDate && s.artistName)
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.TICKETMASTER_API_KEY) {
    return NextResponse.json({ shows: [], count: 0, error: 'TICKETMASTER_API_KEY not set in environment variables' })
  }

  const shows = await scrapeTicketmaster()

  // Deduplicate by date
  const seen = new Set<string>()
  const unique = shows.filter(s => {
    if (seen.has(s.showDate)) return false
    seen.add(s.showDate)
    return true
  }).sort((a, b) => a.showDate.localeCompare(b.showDate))

  return NextResponse.json({ shows: unique, count: unique.length })
}

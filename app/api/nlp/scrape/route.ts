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

async function scrapeTicketWeb(): Promise<ScrapedShow[]> {
  const res = await fetch('https://www.ticketweb.com/search?q=nikki+lopez', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36', 'Accept': 'text/html' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return []
  const html = await res.text()

  const shows: ScrapedShow[] = []

  // Parse event cards — TicketWeb embeds JSON-LD or structured event data
  for (const match of Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))) {
    try {
      const data = JSON.parse(match[1])
      const events = Array.isArray(data) ? data : data['@type'] === 'Event' ? [data] : []
      for (const ev of events) {
        if (ev['@type'] !== 'Event') continue
        const dateStr = ev.startDate?.split('T')[0]
        const name = ev.name || ev.performer?.name
        if (dateStr && name) {
          shows.push({ showDate: dateStr, artistName: name, ticketUrl: ev.url })
        }
      }
    } catch { /* skip */ }
  }

  // Fallback: regex parse visible event names and dates
  if (shows.length === 0) {
    const datePattern = /(\w+ \d{1,2},? \d{4})/g
    const titlePattern = /class="[^"]*event[^"]*title[^"]*"[^>]*>([^<]+)</gi
    const titles = Array.from(html.matchAll(titlePattern)).map(m => m[1].trim())
    const dates = Array.from(html.matchAll(datePattern)).map(m => m[1])
    for (let i = 0; i < Math.min(titles.length, dates.length); i++) {
      const d = new Date(dates[i])
      if (!isNaN(d.getTime())) {
        shows.push({ showDate: d.toISOString().split('T')[0], artistName: titles[i] })
      }
    }
  }

  return shows
}

async function scrapeEventbrite(): Promise<ScrapedShow[]> {
  const res = await fetch('https://www.eventbrite.com/d/united-states/nikki-lopez/', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'text/html' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) return []
  const html = await res.text()
  const shows: ScrapedShow[] = []

  for (const match of Array.from(html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g))) {
    try {
      const data = JSON.parse(match[1])
      const events = Array.isArray(data) ? data : [data]
      for (const ev of events) {
        if (ev['@type'] !== 'Event') continue
        const dateStr = ev.startDate?.split('T')[0]
        const name = ev.name
        if (dateStr && name) {
          shows.push({ showDate: dateStr, artistName: name, ticketUrl: ev.url })
        }
      }
    } catch { /* skip */ }
  }

  return shows
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [tw, eb] = await Promise.allSettled([scrapeTicketWeb(), scrapeEventbrite()])

  const all: ScrapedShow[] = [
    ...(tw.status === 'fulfilled' ? tw.value : []),
    ...(eb.status === 'fulfilled' ? eb.value : []),
  ]

  // Deduplicate by date
  const seen = new Set<string>()
  const shows = all.filter(s => {
    if (seen.has(s.showDate)) return false
    seen.add(s.showDate)
    return true
  }).sort((a, b) => a.showDate.localeCompare(b.showDate))

  return NextResponse.json({ shows, count: shows.length })
}

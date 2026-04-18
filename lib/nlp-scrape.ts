export type ScrapedShow = {
  showDate: string
  artistName: string
  genre?: string
  description?: string
  ticketUrl?: string
}

type ScenicShow = {
  title: string
  description: string
  date: string
  ticketUrl?: string
}

export async function scrapeScenic(): Promise<ScenicShow[]> {
  try {
    const res = await fetch('https://scenicnyc.com/nikkilopez/', { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const html = await res.text()
    const results: ScenicShow[] = []
    const h4Matches = Array.from(html.matchAll(/<h4[^>]*>([\s\S]*?)<\/h4>/gi))
    for (const h4Match of h4Matches) {
      const rawTitle = h4Match[1].replace(/<[^>]+>/g, '').trim()
      if (!rawTitle || rawTitle.length < 3) continue
      const startIdx = h4Match.index! + h4Match[0].length
      const nextH4 = html.indexOf('<h4', startIdx)
      const block = html.slice(startIdx, nextH4 > 0 ? nextH4 : startIdx + 2000)
      const pTexts = Array.from(block.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi))
        .map(m => m[1].replace(/<[^>]+>/g, '').trim())
        .filter(t => t.length > 0)
      const dateMatch = block.match(/\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2})\b/i)
      const rawDate = dateMatch ? `${dateMatch[1]} ${dateMatch[2]}` : ''
      const ticketMatch = block.match(/href="([^"]*ticketweb[^"]*|[^"]*tickets[^"]*|[^"]*eventbrite[^"]*)"/i)
      const ticketUrl = ticketMatch ? ticketMatch[1] : undefined
      const description = pTexts.slice(0, 2).join(' ').slice(0, 200) || undefined
      results.push({ title: rawTitle, description: description || '', date: rawDate, ticketUrl })
    }
    return results
  } catch { return [] }
}

export function parseScenicDate(rawDate: string, year: number): string | null {
  if (!rawDate) return null
  const months: Record<string, string> = {
    january: '01', february: '02', march: '03', april: '04',
    may: '05', june: '06', july: '07', august: '08',
    september: '09', october: '10', november: '11', december: '12',
  }
  const m = rawDate.match(/^(\w+)\s+(\d{1,2})$/i)
  if (!m) return null
  const mo = months[m[1].toLowerCase()]
  if (!mo) return null
  return `${year}-${mo}-${m[2].padStart(2, '0')}`
}

export async function scrapeTicketmaster(): Promise<ScrapedShow[]> {
  const apiKey = process.env.TICKETMASTER_API_KEY
  if (!apiKey) return []
  try {
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?keyword=nikki+lopez&apikey=${apiKey}&size=50&sort=date,asc`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    const events = data?._embedded?.events ?? []
    return events
      .filter((ev: Record<string, unknown>) => {
        const dates = ev.dates as Record<string, unknown>
        const status = (dates?.status as Record<string, string>)?.code
        return status !== 'cancelled' && status !== 'postponed'
      })
      .map((ev: Record<string, unknown>) => {
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
      })
      .filter((s: ScrapedShow) => s.showDate && s.artistName)
  } catch { return [] }
}

export async function getLiveShows(): Promise<ScrapedShow[]> {
  const year = new Date().getFullYear()
  const [tmShows, scenicShows] = await Promise.all([scrapeTicketmaster(), scrapeScenic()])

  const scenicByDate: Record<string, ScenicShow> = {}
  for (const s of scenicShows) {
    const date = parseScenicDate(s.date, year)
    if (date) scenicByDate[date] = s
    else {
      const dateNext = parseScenicDate(s.date, year + 1)
      if (dateNext) scenicByDate[dateNext] = s
    }
  }

  const enriched = tmShows.map(s => ({
    ...s,
    description: scenicByDate[s.showDate]?.description || s.description,
    ticketUrl: s.ticketUrl || scenicByDate[s.showDate]?.ticketUrl,
  }))

  for (const [date, scenic] of Object.entries(scenicByDate)) {
    const alreadyHave = enriched.some(s => s.showDate === date)
    if (!alreadyHave && date) {
      enriched.push({
        showDate: date,
        artistName: scenic.title,
        description: scenic.description,
        ticketUrl: scenic.ticketUrl,
      })
    }
  }

  const seen = new Set<string>()
  return enriched
    .filter(s => {
      const key = `${s.showDate}|${s.artistName}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
    .sort((a, b) => a.showDate.localeCompare(b.showDate))
}

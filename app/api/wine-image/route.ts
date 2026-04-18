import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const name = searchParams.get('name') || ''
  const producer = searchParams.get('producer') || ''
  const vintage = searchParams.get('vintage') || ''

  const query = [name, producer, vintage].filter(Boolean).join(' ')

  // Try Wine-Searcher OG image
  try {
    const res = await fetch(
      `https://www.wine-searcher.com/find/${encodeURIComponent(query.replace(/\s+/g, '+'))}`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }, signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const html = await res.text()
      const match = html.match(/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/)
        || html.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/)
      if (match?.[1] && !match[1].includes('logo') && !match[1].includes('default')) {
        return NextResponse.json({ url: match[1] })
      }
    }
  } catch {}

  // Try Vivino search
  try {
    const res = await fetch(
      `https://www.vivino.com/search/wines?q=${encodeURIComponent(query)}`,
      { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'text/html' }, signal: AbortSignal.timeout(6000) }
    )
    if (res.ok) {
      const html = await res.text()
      const match = html.match(/https:\/\/images\.vivino\.com\/thumbs\/[^"'\s]+\.jpg/)
      if (match?.[0]) return NextResponse.json({ url: match[0] })
    }
  } catch {}

  return NextResponse.json({ url: null })
}

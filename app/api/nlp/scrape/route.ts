import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getLiveShows } from '@/lib/nlp-scrape'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (!process.env.TICKETMASTER_API_KEY) {
    return NextResponse.json({ shows: [], count: 0, error: 'TICKETMASTER_API_KEY not set in environment variables' })
  }

  const shows = await getLiveShows()
  return NextResponse.json({ shows, count: shows.length })
}

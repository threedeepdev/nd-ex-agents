import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'

const CONTEXT_SECRET = process.env.CELLAR_CONTEXT_SECRET!

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!auth || auth !== `Bearer ${CONTEXT_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL!)
  const rows = await sql`SELECT * FROM wines ORDER BY added_date DESC`

  const wines = rows.map(r => ({
    id: r.id,
    name: r.name,
    producer: r.producer ?? undefined,
    vintage: r.vintage ?? undefined,
    region: r.region ?? undefined,
    country: r.country ?? undefined,
    varietal: r.varietal ?? undefined,
    score: r.score ?? undefined,
    estimatedRetailCost: r.estimated_retail_cost ?? undefined,
    drinkFrom: r.drink_from ?? undefined,
    drinkUntil: r.drink_until ?? undefined,
    notes: r.notes ?? undefined,
    addedDate: r.added_date ?? undefined,
    status: r.status,
    tasted: r.tasted ?? undefined,
    consumedDate: r.consumed_date ?? undefined,
    myRating: r.my_rating ?? undefined,
  }))

  return NextResponse.json(wines)
}

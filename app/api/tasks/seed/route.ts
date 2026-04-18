import { NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb, ensureTables, computeNextRun } from '@/lib/tasks'

export async function POST() {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTables()
  const sql = getDb()

  const existing = await sql`
    SELECT id FROM agent_tasks WHERE agent_id = 'nlp' AND task_type = 'nlp-sync' LIMIT 1
  `
  if (existing.length > 0) {
    return NextResponse.json({ created: false, id: existing[0].id })
  }

  const id = `task-${crypto.randomUUID().split('-')[0]}`
  const createdAt = new Date().toISOString()
  const nextRunAt = computeNextRun('weekly-saturday')

  await sql`
    INSERT INTO agent_tasks (id, name, description, message, schedule, agent_id, task_type, enabled, created_at, next_run_at)
    VALUES (
      ${id},
      ${'Weekly Show Sync'},
      ${'Scrape Ticketmaster + Scenic NYC for next week\'s Nikki Lopez shows and save to database'},
      ${null},
      ${'weekly-saturday'},
      ${'nlp'},
      ${'nlp-sync'},
      ${true},
      ${createdAt},
      ${nextRunAt}
    )
  `

  return NextResponse.json({ created: true, id, nextRunAt })
}

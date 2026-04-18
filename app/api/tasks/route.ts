import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'

function getDb() {
  return neon(process.env.DATABASE_URL!)
}

export async function ensureTables() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      message     TEXT NOT NULL,
      schedule    TEXT NOT NULL,
      agent_id    TEXT NOT NULL DEFAULT 'vino',
      enabled     BOOLEAN DEFAULT true,
      created_at  TEXT NOT NULL,
      last_run_at TEXT,
      next_run_at TEXT
    )
  `
  await sql`
    CREATE TABLE IF NOT EXISTS agent_task_runs (
      id           TEXT PRIMARY KEY,
      task_id      TEXT NOT NULL REFERENCES agent_tasks(id) ON DELETE CASCADE,
      started_at   TEXT NOT NULL,
      completed_at TEXT,
      status       TEXT NOT NULL DEFAULT 'running',
      result       TEXT
    )
  `
}

export function computeNextRun(schedule: string): string {
  const now = new Date()
  if (schedule === 'hourly') {
    now.setHours(now.getHours() + 1, 0, 0, 0)
  } else if (schedule === 'daily') {
    now.setDate(now.getDate() + 1)
    now.setHours(9, 0, 0, 0)
  } else if (schedule === 'weekly') {
    const daysUntilMonday = ((8 - now.getDay()) % 7) || 7
    now.setDate(now.getDate() + daysUntilMonday)
    now.setHours(9, 0, 0, 0)
  }
  return now.toISOString()
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTables()
  const sql = getDb()

  const tasks = await sql`SELECT * FROM agent_tasks ORDER BY created_at DESC`
  const runs = await sql`
    SELECT DISTINCT ON (task_id) id, task_id, started_at, completed_at, status, LEFT(result, 300) AS result
    FROM agent_task_runs
    ORDER BY task_id, started_at DESC
  `

  const runsMap = Object.fromEntries(runs.map(r => [r.task_id as string, r]))
  return NextResponse.json({ tasks: tasks.map(t => ({ ...t, lastRun: runsMap[t.id as string] || null })) })
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTables()
  const { name, description, message, schedule, agentId = 'vino' } = await req.json()
  if (!name || !message || !schedule) {
    return NextResponse.json({ error: 'name, message, and schedule are required' }, { status: 400 })
  }

  const sql = getDb()
  const id = `task-${crypto.randomUUID().split('-')[0]}`
  const createdAt = new Date().toISOString()
  const nextRunAt = computeNextRun(schedule)

  await sql`
    INSERT INTO agent_tasks (id, name, description, message, schedule, agent_id, enabled, created_at, next_run_at)
    VALUES (${id}, ${name}, ${description ?? null}, ${message}, ${schedule}, ${agentId}, true, ${createdAt}, ${nextRunAt})
  `

  return NextResponse.json({ id, name, description, message, schedule, agentId, enabled: true, createdAt, nextRunAt })
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id, enabled } = await req.json()
  const sql = getDb()
  await sql`UPDATE agent_tasks SET enabled = ${enabled} WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const sql = getDb()
  await sql`DELETE FROM agent_tasks WHERE id = ${id}`
  return NextResponse.json({ ok: true })
}

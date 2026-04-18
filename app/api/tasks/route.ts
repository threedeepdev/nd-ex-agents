import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { getDb, ensureTables, computeNextRun, seedDefaultTasks } from '@/lib/tasks'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  await ensureTables()
  await seedDefaultTasks()
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
  const { name, description, message, schedule, agentId = 'vino', taskType = 'openclaw' } = await req.json()
  if (!name || !schedule) {
    return NextResponse.json({ error: 'name and schedule are required' }, { status: 400 })
  }
  if (taskType === 'openclaw' && !message) {
    return NextResponse.json({ error: 'message is required for openclaw tasks' }, { status: 400 })
  }

  const sql = getDb()
  const id = `task-${crypto.randomUUID().split('-')[0]}`
  const createdAt = new Date().toISOString()
  const nextRunAt = computeNextRun(schedule)

  await sql`
    INSERT INTO agent_tasks (id, name, description, message, schedule, agent_id, task_type, enabled, created_at, next_run_at)
    VALUES (${id}, ${name}, ${description ?? null}, ${message ?? null}, ${schedule}, ${agentId}, ${taskType}, true, ${createdAt}, ${nextRunAt})
  `

  return NextResponse.json({ id, name, description, message, schedule, agentId, taskType, enabled: true, createdAt, nextRunAt })
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

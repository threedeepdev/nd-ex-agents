import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { neon } from '@neondatabase/serverless'
import { computeNextRun } from '../route'

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL!
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!

async function runViaOpenClaw(message: string): Promise<string> {
  const res = await fetch(`${GATEWAY}/api/agent/message`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId: 'vino', message, sessionId: 'task-runner' }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`OpenClaw ${res.status}`)
  const data = await res.json()
  return data.message || data.content || data.reply || 'No response'
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { taskId } = await req.json()
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 })

  const sql = neon(process.env.DATABASE_URL!)
  const tasks = await sql`SELECT * FROM agent_tasks WHERE id = ${taskId}`
  if (!tasks.length) return NextResponse.json({ error: 'Task not found' }, { status: 404 })
  const task = tasks[0]

  const runId = `run-${crypto.randomUUID().split('-')[0]}`
  const startedAt = new Date().toISOString()

  await sql`
    INSERT INTO agent_task_runs (id, task_id, started_at, status)
    VALUES (${runId}, ${task.id}, ${startedAt}, 'running')
  `

  try {
    const result = await runViaOpenClaw(task.message as string)
    const completedAt = new Date().toISOString()

    await sql`
      UPDATE agent_task_runs
      SET status = 'completed', result = ${result}, completed_at = ${completedAt}
      WHERE id = ${runId}
    `
    await sql`
      UPDATE agent_tasks
      SET last_run_at = ${completedAt}, next_run_at = ${computeNextRun(task.schedule as string)}
      WHERE id = ${task.id}
    `

    return NextResponse.json({ runId, status: 'completed', result })
  } catch (err) {
    await sql`
      UPDATE agent_task_runs
      SET status = 'failed', completed_at = ${new Date().toISOString()}
      WHERE id = ${runId}
    `
    return NextResponse.json({ error: 'Task execution failed' }, { status: 500 })
  }
}

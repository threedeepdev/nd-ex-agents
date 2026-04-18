import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { computeNextRun } from '@/lib/tasks'

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

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sql = neon(process.env.DATABASE_URL!)
  const now = new Date().toISOString()

  const dueTasks = await sql`
    SELECT * FROM agent_tasks
    WHERE enabled = true AND next_run_at <= ${now}
  `

  const results = []
  for (const task of dueTasks) {
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
      results.push({ taskId: task.id, status: 'completed' })
    } catch {
      await sql`
        UPDATE agent_task_runs
        SET status = 'failed', completed_at = ${new Date().toISOString()}
        WHERE id = ${runId}
      `
      results.push({ taskId: task.id, status: 'failed' })
    }
  }

  return NextResponse.json({ ran: results.length, results })
}

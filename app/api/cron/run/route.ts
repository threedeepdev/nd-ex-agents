import { NextRequest, NextResponse } from 'next/server'
import { neon } from '@neondatabase/serverless'
import { computeNextRun } from '@/lib/tasks'

const GATEWAY = process.env.OPENCLAW_GATEWAY_URL!
const TOKEN = process.env.OPENCLAW_GATEWAY_TOKEN!

async function runViaOpenClaw(message: string, agentId = 'vino'): Promise<string> {
  const res = await fetch(`${GATEWAY}/api/agent/message`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, message, sessionId: 'task-runner' }),
    signal: AbortSignal.timeout(60000),
  })
  if (!res.ok) throw new Error(`OpenClaw ${res.status}`)
  const data = await res.json()
  return data.message || data.content || data.reply || 'No response'
}

async function runNlpSync(): Promise<string> {
  const sql = neon(process.env.DATABASE_URL!)

  const now = new Date()
  const daysUntilMon = ((8 - now.getUTCDay()) % 7) || 7
  const nextMon = new Date(now)
  nextMon.setUTCDate(now.getUTCDate() + daysUntilMon)
  nextMon.setUTCHours(0, 0, 0, 0)
  const weekStart = nextMon.toISOString().split('T')[0]
  const weekEndDate = new Date(nextMon)
  weekEndDate.setUTCDate(nextMon.getUTCDate() + 6)
  const weekEnd = weekEndDate.toISOString().split('T')[0]

  const base = process.env.NEXTAUTH_URL || 'https://www.nd-ex.com'
  const scrapeRes = await fetch(`${base}/api/nlp/scrape`, { signal: AbortSignal.timeout(20000) })
  if (!scrapeRes.ok) throw new Error('Scrape failed')
  const { shows } = await scrapeRes.json() as { shows: { showDate: string; artistName: string; genre?: string }[] }

  const nextWeekShows = shows.filter(s => s.showDate >= weekStart && s.showDate <= weekEnd)
  let saved = 0
  for (const show of nextWeekShows) {
    const id = `show-${crypto.randomUUID().split('-')[0]}`
    await sql`
      INSERT INTO nlp_shows (id, show_date, artist_name, genre, created_at)
      VALUES (${id}, ${show.showDate}, ${show.artistName}, ${show.genre ?? null}, ${new Date().toISOString()})
      ON CONFLICT (show_date, artist_name) DO NOTHING
    `
    saved++
  }

  return `Week of ${weekStart}: found ${shows.length} shows online, saved ${saved} for next week.`
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
      const result = task.task_type === 'nlp-sync'
        ? await runNlpSync()
        : await runViaOpenClaw(task.message as string, task.agent_id as string)

      const completedAt = new Date().toISOString()
      await sql`UPDATE agent_task_runs SET status = 'completed', result = ${result}, completed_at = ${completedAt} WHERE id = ${runId}`
      await sql`UPDATE agent_tasks SET last_run_at = ${completedAt}, next_run_at = ${computeNextRun(task.schedule as string)} WHERE id = ${task.id}`
      results.push({ taskId: task.id, status: 'completed' })
    } catch {
      await sql`UPDATE agent_task_runs SET status = 'failed', completed_at = ${new Date().toISOString()} WHERE id = ${runId}`
      results.push({ taskId: task.id, status: 'failed' })
    }
  }

  return NextResponse.json({ ran: results.length, results })
}

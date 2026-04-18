import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
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

async function runNlpSync(): Promise<string> {
  const sql = neon(process.env.DATABASE_URL!)

  // Compute next week's Monday
  const now = new Date()
  const daysUntilMon = ((8 - now.getUTCDay()) % 7) || 7
  const nextMon = new Date(now)
  nextMon.setUTCDate(now.getUTCDate() + daysUntilMon)
  nextMon.setUTCHours(0, 0, 0, 0)
  const weekStart = nextMon.toISOString().split('T')[0]
  const weekEndDate = new Date(nextMon)
  weekEndDate.setUTCDate(nextMon.getUTCDate() + 6)
  const weekEnd = weekEndDate.toISOString().split('T')[0]

  // Scrape TicketWeb
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
      ON CONFLICT DO NOTHING
    `
    saved++
  }

  return `Week of ${weekStart}: found ${shows.length} total shows online, saved ${saved} for next week. Poster ready at /api/nlp/poster?week=${weekStart}`
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
    const result = task.task_type === 'nlp-sync'
      ? await runNlpSync()
      : await runViaOpenClaw(task.message as string)

    const completedAt = new Date().toISOString()
    await sql`UPDATE agent_task_runs SET status = 'completed', result = ${result}, completed_at = ${completedAt} WHERE id = ${runId}`
    await sql`UPDATE agent_tasks SET last_run_at = ${completedAt}, next_run_at = ${computeNextRun(task.schedule as string)} WHERE id = ${task.id}`

    return NextResponse.json({ runId, status: 'completed', result })
  } catch (err) {
    await sql`UPDATE agent_task_runs SET status = 'failed', completed_at = ${new Date().toISOString()} WHERE id = ${runId}`
    return NextResponse.json({ error: 'Task execution failed' }, { status: 500 })
  }
}

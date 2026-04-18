import { neon } from '@neondatabase/serverless'

export function getDb() {
  return neon(process.env.DATABASE_URL!)
}

export async function ensureTables() {
  const sql = getDb()
  await sql`
    CREATE TABLE IF NOT EXISTS agent_tasks (
      id          TEXT PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      message     TEXT,
      schedule    TEXT NOT NULL,
      agent_id    TEXT NOT NULL DEFAULT 'vino',
      task_type   TEXT NOT NULL DEFAULT 'openclaw',
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
  // Add columns to existing tables
  await sql`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS task_type TEXT NOT NULL DEFAULT 'openclaw'`
  await sql`ALTER TABLE agent_tasks ADD COLUMN IF NOT EXISTS agent_id TEXT NOT NULL DEFAULT 'vino'`
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
  } else if (schedule === 'weekly-saturday') {
    // Next Saturday at 15:00 UTC (10am EST / 11am EDT)
    const daysUntilSat = ((6 - now.getUTCDay() + 7) % 7) || 7
    now.setUTCDate(now.getUTCDate() + daysUntilSat)
    now.setUTCHours(15, 0, 0, 0)
  }
  return now.toISOString()
}

export async function seedDefaultTasks() {
  const sql = getDb()
  const existing = await sql`SELECT id FROM agent_tasks WHERE agent_id = 'nlp' AND task_type = 'nlp-sync' LIMIT 1`
  if (existing.length > 0) return

  const id = `task-${crypto.randomUUID().split('-')[0]}`
  const createdAt = new Date().toISOString()
  const nextRunAt = computeNextRun('weekly-saturday')
  await sql`
    INSERT INTO agent_tasks (id, name, description, message, schedule, agent_id, task_type, enabled, created_at, next_run_at)
    VALUES (${id}, 'Weekly Show Sync', 'Scrape Ticketmaster for next week''s Nikki Lopez shows', null, 'weekly-saturday', 'nlp', 'nlp-sync', true, ${createdAt}, ${nextRunAt})
  `
}

export function scheduleLabel(s: string) {
  if (s === 'hourly') return 'Every hour'
  if (s === 'daily') return 'Daily 9am'
  if (s === 'weekly') return 'Weekly Mon'
  if (s === 'weekly-saturday') return 'Sat 10am EST'
  return s
}

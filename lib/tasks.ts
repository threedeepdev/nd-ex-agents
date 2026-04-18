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

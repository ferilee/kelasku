import { drizzle } from 'drizzle-orm/bun-sqlite';
import { Database } from 'bun:sqlite';
import * as schema from './schema';

const sqlite = new Database(process.env.DATABASE_URL || 'sqlite.db');
sqlite.run(`
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day TEXT NOT NULL,
    subject TEXT NOT NULL,
    time_start TEXT NOT NULL,
    time_end TEXT NOT NULL,
    teacher_name TEXT,
    color TEXT NOT NULL DEFAULT 'blue',
    created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
  )
`);
export const db = drizzle(sqlite, { schema });

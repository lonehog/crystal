import { Database } from 'bun:sqlite';

export function initDatabase(): Database {
  const db = new Database('crystal.db');

  // Create jobs table
  db.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      company TEXT NOT NULL,
      location TEXT NOT NULL,
      url TEXT UNIQUE NOT NULL,
      posted_at TEXT,
      role_slug TEXT NOT NULL,
      description TEXT,
      qualifications TEXT,
      source TEXT DEFAULT 'stepstone',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // Add description and qualifications columns if they don't exist (for existing databases)
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN description TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN qualifications TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN source TEXT DEFAULT 'stepstone'`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Create settings table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // Create index for faster queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_jobs_role_slug ON jobs(role_slug);
    CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
  `);

  console.log('✅ Database initialized');

  return db;
}


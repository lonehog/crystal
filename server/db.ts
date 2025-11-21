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
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN is_favorite INTEGER DEFAULT 0`);
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

  // Add relevance score and filtering columns if they don't exist
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN relevance_score INTEGER DEFAULT 0`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN filtered_reason TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }
  try {
    db.exec(`ALTER TABLE jobs ADD COLUMN matched_keywords TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Create indexes for faster queries and duplicate detection
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_jobs_role_slug ON jobs(role_slug);
    CREATE INDEX IF NOT EXISTS idx_jobs_posted_at ON jobs(posted_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);
    CREATE INDEX IF NOT EXISTS idx_jobs_source ON jobs(source);
    CREATE INDEX IF NOT EXISTS idx_jobs_favorite ON jobs(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_jobs_relevance ON jobs(relevance_score);
    
    -- Performance indexes for duplicate detection
    CREATE INDEX IF NOT EXISTS idx_jobs_url_unique ON jobs(url);
    CREATE INDEX IF NOT EXISTS idx_jobs_content_composite ON jobs(title, company, location);
  `);

  console.log('✅ Database initialized');

  return db;
}

export function jobExists(db: Database, url: string): boolean {
  const stmt = db.prepare('SELECT 1 FROM jobs WHERE url = ?');
  const result = stmt.get(url);
  return !!result;
}

export function checkJobsExist(db: Database, urls: string[]): Set<string> {
  if (urls.length === 0) return new Set();
  
  // Use a single query with placeholders for multiple URLs
  const placeholders = urls.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT url FROM jobs WHERE url IN (${placeholders})`);
  const results = stmt.all(...urls) as Array<{url: string}>;
  
  // Return set of existing URLs for O(1) lookup
  return new Set(results.map(row => row.url));
}

export function getExistingJobsByContent(db: Database, jobs: Array<{title: string, company: string, location: string}>): Set<string> {
  // Check for potential duplicates by title+company+location combination
  // This helps catch jobs that might be posted with different URLs
  const stmt = db.prepare(`
    SELECT title, company, location, url 
    FROM jobs 
    WHERE title = ? AND company = ? AND location = ?
  `);
  
  const existingKeys = new Set<string>();
  for (const job of jobs) {
    const result = stmt.get(job.title, job.company, job.location);
    if (result) {
      // Create a unique key for this job combination
      existingKeys.add(`${job.title}|${job.company}|${job.location}`);
    }
  }
  
  return existingKeys;
}


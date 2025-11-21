import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { Database } from 'bun:sqlite';
import { scrapeStepStone, scrapeGlassdoor } from './scraper';
import { initDatabase } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize database
const db = initDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/jobs', (req, res) => {
  try {
    const { role, limit = 1000, source } = req.query;
    let query = 'SELECT * FROM jobs';
    const params: any[] = [];
    const conditions: string[] = [];

    if (role) {
      conditions.push('role_slug = ?');
      params.push(role);
    }

    if (source && (source === 'stepstone' || source === 'glassdoor')) {
      conditions.push('source = ?');
      params.push(source);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY created_at DESC LIMIT ?';
    params.push(parseInt(limit as string));

    const stmt = db.prepare(query);
    const jobs = stmt.all(...params) as any[];

    res.json({ success: true, data: jobs });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/stats', async (req, res) => {
  try {
    // Total jobs
    const totalStmt = db.prepare('SELECT COUNT(*) as count FROM jobs');
    const totalResult = totalStmt.get() as { count: number };

    // Jobs in last 24 hours
    const yesterday = new Date();
    yesterday.setHours(yesterday.getHours() - 24);
    const yesterdayStmt = db.prepare(
      'SELECT COUNT(*) as count FROM jobs WHERE created_at > ?'
    );
    const yesterdayResult = yesterdayStmt.get(yesterday.toISOString()) as {
      count: number;
    };

    // Jobs per day (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const dailyStmt = db.prepare(`
      SELECT DATE(created_at) as date, COUNT(*) as count 
      FROM jobs 
      WHERE created_at > ? 
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    const dailyData = dailyStmt.all(sevenDaysAgo.toISOString()) as any[];

    res.json({
      success: true,
      data: {
        total: totalResult.count,
        last24h: yesterdayResult.count,
        daily: dailyData,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/roles', (req, res) => {
  try {
    const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = stmt.get('active_roles') as { value: string } | undefined;
    const roles = result ? JSON.parse(result.value) : [];

    res.json({ success: true, data: roles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/roles', (req, res) => {
  try {
    const { role } = req.body;
    if (!role || typeof role !== 'string') {
      return res
        .status(400)
        .json({ success: false, error: 'Role is required' });
    }

    // Get current roles
    const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = getStmt.get('active_roles') as { value: string } | undefined;
    const roles = result ? JSON.parse(result.value) : [];

    // Add role if not exists
    if (!roles.includes(role)) {
      roles.push(role);
      const rolesJson = JSON.stringify(roles);

      // Upsert
      const upsertStmt = db.prepare(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
      );
      upsertStmt.run('active_roles', rolesJson);

      res.json({ success: true, data: roles });
    } else {
      res.json({ success: true, data: roles, message: 'Role already exists' });
    }
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/roles/:role', (req, res) => {
  try {
    const { role } = req.params;

    // Get current roles
    const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = getStmt.get('active_roles') as { value: string } | undefined;
    const roles = result ? JSON.parse(result.value) : [];

    // Remove role
    const filteredRoles = roles.filter((r: string) => r !== role);
    const rolesJson = JSON.stringify(filteredRoles);

    // Update
    const upsertStmt = db.prepare(
      'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)'
    );
    upsertStmt.run('active_roles', rolesJson);

    res.json({ success: true, data: filteredRoles });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/scan', async (req, res) => {
  try {
    // Get active roles
    const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = getStmt.get('active_roles') as { value: string } | undefined;
    const roles = result ? JSON.parse(result.value) : [];

    if (roles.length === 0) {
      return res.json({
        success: true,
        message: 'No active roles to scan',
        data: { scanned: 0 },
      });
    }

    // Scrape all roles from both portals
    let totalScraped = 0;
    for (const role of roles) {
      console.log(`\n🔄 Scanning ${role}...`);
      const stepstoneCount = await scrapeStepStone(role, db);
      const glassdoorCount = await scrapeGlassdoor(role, db);
      totalScraped += stepstoneCount + glassdoorCount;
    }

    res.json({
      success: true,
      message: `Scanned ${roles.length} role(s) from both portals`,
      data: { scanned: totalScraped },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Crystal server running on http://localhost:${PORT}`);
});

// Schedule hourly scraping
cron.schedule('0 * * * *', async () => {
  console.log('⏰ Running scheduled scan...');
  try {
    const getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    const result = getStmt.get('active_roles') as { value: string } | undefined;
    const roles = result ? JSON.parse(result.value) : [];

    for (const role of roles) {
      await scrapeStepStone(role, db);
      await scrapeGlassdoor(role, db);
    }
    console.log('✅ Scheduled scan completed');
  } catch (error) {
    console.error('❌ Scheduled scan failed:', error);
  }
});

console.log('📅 Hourly cron job scheduled');


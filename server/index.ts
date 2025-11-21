import express from 'express';
import cors from 'cors';
import cron from 'node-cron';
import { Database } from 'bun:sqlite';
import { scrapeStepStone, scrapeGlassdoor } from './scraper';
import { initDatabase } from './db';

const app = express();
const PORT = process.env.PORT || 3001;

// Track server start time
const serverStartTime = new Date();

// Initialize database
const db = initDatabase();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.get('/api/jobs', (req, res) => {
  try {
    const { role, limit = 1000, source, since } = req.query;
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

    if (since) {
      conditions.push('created_at > ?');
      params.push(since);
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
    console.error(`[API ERROR]`, error);
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

app.get('/api/next-scan', (req, res) => {
  try {
    const now = new Date();
    const nextHour = new Date(now);
    nextHour.setHours(nextHour.getHours() + 1);
    nextHour.setMinutes(0);
    nextHour.setSeconds(0);
    nextHour.setMilliseconds(0);

    const timeUntil = nextHour.getTime() - now.getTime();
    const minutesUntil = Math.floor(timeUntil / 60000);

    res.json({
      success: true,
      data: {
        nextScan: nextHour.toISOString(),
        minutesUntil,
        formatted: nextHour.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        }),
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/uptime', (req, res) => {
  try {
    const now = new Date();
    const uptimeMs = now.getTime() - serverStartTime.getTime();
    const uptimeHours = uptimeMs / (1000 * 60 * 60);

    // Generate hourly uptime data for last 24 hours
    const uptimeData = [];
    const hoursAgo24 = new Date(now);
    hoursAgo24.setHours(hoursAgo24.getHours() - 24);

    for (let i = 23; i >= 0; i--) {
      const hourTime = new Date(now);
      hourTime.setHours(hourTime.getHours() - i);
      hourTime.setMinutes(0);
      hourTime.setSeconds(0);
      hourTime.setMilliseconds(0);

      // If server started before this hour, uptime is 100%, otherwise calculate percentage
      const hourStart = hourTime.getTime();
      const hourEnd = hourStart + 3600000; // 1 hour in ms
      const serverStart = serverStartTime.getTime();

      let uptimePercent = 100;
      if (serverStart > hourEnd) {
        // Server started after this hour, no uptime
        uptimePercent = 0;
      } else if (serverStart > hourStart) {
        // Server started during this hour, calculate partial uptime
        const uptimeInHour = hourEnd - serverStart;
        uptimePercent = (uptimeInHour / 3600000) * 100;
      }
      // If server started before this hour, it's 100% uptime

      uptimeData.push({
        hour: hourTime.toLocaleTimeString('en-US', {
          hour: 'numeric',
          hour12: true,
        }),
        uptime: Math.round(uptimePercent),
        timestamp: hourTime.toISOString(),
      });
    }

    res.json({
      success: true,
      data: {
        totalUptimeHours: Math.round(uptimeHours * 100) / 100,
        serverStartTime: serverStartTime.toISOString(),
        hourly: uptimeData,
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
    const { source } = req.query;
    const validSources = ['stepstone', 'glassdoor'];
    const scanSource = source as string | undefined;

    if (scanSource && !validSources.includes(scanSource)) {
      return res.status(400).json({
        success: false,
        error: `Invalid source specified. Must be one of: ${validSources.join(', ')}`,
      });
    }

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

    // Scrape roles based on source filter
    let totalScraped = 0;
    const portalsToScan = scanSource ? [scanSource] : validSources;
    
    for (const role of roles) {
      console.log(`\n🔄 Scanning ${role}...`);
      
      if (portalsToScan.includes('stepstone')) {
        const stepstoneCount = await scrapeStepStone(role, db);
        totalScraped += stepstoneCount;
      }
      
      if (portalsToScan.includes('glassdoor')) {
        const glassdoorCount = await scrapeGlassdoor(role, db);
        totalScraped += glassdoorCount;
      }
    }

    const message = scanSource
      ? `Scanned ${roles.length} role(s) from ${scanSource}`
      : `Scanned ${roles.length} role(s) from both portals`;

    res.json({
      success: true,
      message,
      data: { scanned: totalScraped },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Favorite jobs endpoints
app.post('/api/jobs/:id/favorite', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('UPDATE jobs SET is_favorite = 1 WHERE id = ?');
    stmt.run(id);
    res.json({ success: true, message: 'Job favorited' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.delete('/api/jobs/:id/favorite', (req, res) => {
  try {
    const { id } = req.params;
    const stmt = db.prepare('UPDATE jobs SET is_favorite = 0 WHERE id = ?');
    stmt.run(id);
    res.json({ success: true, message: 'Job unfavorited' });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Export jobs endpoint
app.get('/api/jobs/export', (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const stmt = db.prepare('SELECT * FROM jobs ORDER BY created_at DESC');
    const jobs = stmt.all() as any[];

    if (format === 'csv') {
      const headers = ['ID', 'Title', 'Company', 'Location', 'URL', 'Source', 'Posted At', 'Created At'];
      const csvRows = [
        headers.join(','),
        ...jobs.map(job => [
          job.id,
          `"${job.title.replace(/"/g, '""')}"`,
          `"${job.company.replace(/"/g, '""')}"`,
          `"${job.location.replace(/"/g, '""')}"`,
          job.url,
          job.source,
          job.posted_at,
          job.created_at
        ].join(','))
      ];
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=jobs.csv');
      res.send(csvRows.join('\n'));
    } else {
      res.json({ success: true, data: jobs });
    }
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


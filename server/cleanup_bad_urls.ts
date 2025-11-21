import { Database } from 'bun:sqlite';

// Initialize database
const db = new Database('crystal.db');

console.log('🧹 Cleaning up bad job URLs...');

// Delete all StepStone jobs with company profile URLs
const deleteStmt = db.prepare(`
  DELETE FROM jobs 
  WHERE source = 'stepstone' AND url LIKE '%/cmp/de/%'
`);

const result = deleteStmt.run();
console.log(`🗑️  Deleted ${result.changes} jobs with bad company profile URLs`);

// Show remaining jobs
const remainingCount = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
console.log(`📊 Remaining jobs in database: ${remainingCount.count}`);

// Show sample of remaining URLs
const samples = db.prepare('SELECT title, url FROM jobs LIMIT 5').all();
console.log('\n📋 Sample remaining job URLs:');
samples.forEach((job: any) => {
  console.log(`Title: ${job.title}`);
  console.log(`URL: ${job.url}`);
  console.log('---');
});

db.close();
console.log('✅ Cleanup complete!');
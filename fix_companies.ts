#!/usr/bin/env bun

import { Database } from 'bun:sqlite';

const db = new Database('crystal.db');

console.log('🔧 Fixing company names for each job...');

// Get all jobs that need fixing
const jobs = db.prepare(`
  SELECT id, url, title 
  FROM jobs 
  WHERE company = 'Siegenia Gruppe 250330' OR url LIKE '%/cmp/de/%'
`).all() as Array<{id: number, url: string, title: string}>;

console.log(`Found ${jobs.length} jobs to fix company names`);

let updated = 0;
for (const job of jobs) {
  try {
    // Extract company name from this specific job's URL
    const companyMatch = job.url.match(/\/cmp\/de\/([^\/]+)/);
    if (companyMatch) {
      const companySlug = companyMatch[1];
      // Decode URL encoding and format company name properly
      const companyName = decodeURIComponent(companySlug)
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/ Gmbh & Co Kg/g, ' GmbH & Co. KG')
        .replace(/ Gmbh/g, ' GmbH')
        .replace(/ Ag/g, ' AG')
        .replace(/ Indicon/g, ' INDICON')
        .replace(/ System/g, ' System')
        .replace(/ & /g, ' & ')
        .replace(/\s+/g, ' ')
        .trim();

      // Update this specific job
      const updateStmt = db.prepare(`
        UPDATE jobs 
        SET company = ?
        WHERE id = ?
      `);
      
      updateStmt.run(companyName, job.id);
      updated++;
      console.log(`✅ Updated job ${job.id}: ${companyName} (${job.title.substring(0, 50)}...)`);
    }
  } catch (error) {
    console.error(`❌ Failed to update job ${job.id}:`, error);
  }
}

console.log(`\n🎉 Company name fixes completed! Updated ${updated} jobs.`);

// Verify the unique companies
const verification = db.prepare(`
  SELECT company, COUNT(*) as count 
  FROM jobs 
  WHERE company != 'Unknown'
  GROUP BY company 
  ORDER BY count DESC 
  LIMIT 10
`).all();

console.log('\n📊 Company distribution after fix:');
verification.forEach((row: any) => {
  console.log(`   ${row.company}: ${row.count} jobs`);
});

db.close();
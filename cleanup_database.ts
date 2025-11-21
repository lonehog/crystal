#!/usr/bin/env bun

import { Database } from 'bun:sqlite';

const db = new Database('crystal.db');

console.log('🔧 Cleaning up job database...');

// Update company names from URL slugs and fix URLs
const updateStmt = db.prepare(`
  UPDATE jobs 
  SET 
    company = ?,
    location = 'Germany'
  WHERE url LIKE '%/cmp/de/%' AND company = 'Unknown'
`);

// Get all jobs with company profile URLs
const jobs = db.prepare(`
  SELECT id, url, title 
  FROM jobs 
  WHERE url LIKE '%/cmp/de/%'
`).all() as Array<{id: number, url: string, title: string}>;

console.log(`Found ${jobs.length} jobs to clean up`);

let updated = 0;
for (const job of jobs) {
  try {
    // Extract company name from URL: /cmp/de/company-name-jobs or /cmp/de/company-slug
    const companyMatch = job.url.match(/\/cmp\/de\/([^\/]+)/);
    if (companyMatch) {
      const companySlug = companyMatch[1];
      // Decode URL encoding and format company name
      const companyName = decodeURIComponent(companySlug)
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase())
        .replace(/ Gmbh & Co Kg/g, ' GmbH & Co. KG')
        .replace(/ Gmbh/g, ' GmbH')
        .replace(/ Ag/g, ' AG')
        .replace(/ Indicon/g, ' INDICON')
        .replace(/ System/g, ' System')
        .trim();

      // Update only company and location without changing URLs to avoid constraint violations
      updateStmt.run(companyName);
      updated++;
      console.log(`✅ Updated job ${job.id}: ${companyName}`);
    }
  } catch (error) {
    console.error(`❌ Failed to update job ${job.id}:`, error);
  }
}

console.log(`\n🎉 Database cleanup completed! Updated ${updated} jobs.`);

// Verify the updates
const verification = db.prepare(`
  SELECT company, COUNT(*) as count 
  FROM jobs 
  GROUP BY company 
  ORDER BY count DESC 
  LIMIT 10
`).all();

console.log('\n📊 Updated company distribution:');
verification.forEach((row: any) => {
  console.log(`   ${row.company}: ${row.count} jobs`);
});

db.close();
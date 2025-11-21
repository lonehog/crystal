#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import { scrapeGlassdoor } from './scraper';
import { initDatabase } from './db';

console.log('=== TESTING UPDATED GLASSDOOR SCRAPER ===');

// Initialize database
const db = initDatabase();

// Test with the role that's currently in the database
const testRole = 'embedded-systems-engineer';

console.log(`\n🔄 Starting improved Glassdoor scraper test for role: "${testRole}"`);
console.log('⏰ Starting at:', new Date().toISOString());

try {
  const startTime = Date.now();
  const result = await scrapeGlassdoor(testRole, db);
  const endTime = Date.now();
  
  console.log(`\n✅ SCRAPING COMPLETE`);
  console.log(`📊 Time taken: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
  console.log(`📈 New jobs added: ${result}`);
  
  // Check what we actually got
  const totalGlassdoorJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE source = "glassdoor"').get() as any;
  console.log(`💾 Total Glassdoor jobs in DB: ${totalGlassdoorJobs.count}`);
  
  // Show some recent glassdoor jobs if any
  if (totalGlassdoorJobs.count > 0) {
    const recentGlassdoorJobs = db.prepare(`
      SELECT id, title, company, location, url, created_at 
      FROM jobs 
      WHERE source = 'glassdoor'
      ORDER BY id DESC 
      LIMIT 5
    `).all();
    
    console.log('\n📋 Recent Glassdoor Jobs:');
    recentGlassdoorJobs.forEach((job: any, index: number) => {
      console.log(`${index + 1}. "${job.title}" at ${job.company} (${job.location})`);
      console.log(`   URL: ${job.url}`);
    });
  }
  
} catch (error: any) {
  console.error(`\n❌ SCRAPING FAILED:`, error.message);
  console.error('Stack:', error.stack);
}

db.close();
#!/usr/bin/env bun

import { Database } from 'bun:sqlite';
import { scrapeGlassdoor } from './server/scraper';
import { initDatabase } from './server/db';

console.log('=== TESTING GLASSDOOR SCRAPER DIRECTLY ===');

// Initialize database
const db = initDatabase();

// Test with the role that's currently in the database
const testRole = 'embedded-systems-engineer';

console.log(`\n🔄 Starting Glassdoor scraper test for role: "${testRole}"`);
console.log('⏰ Starting at:', new Date().toISOString());

try {
  const startTime = Date.now();
  const result = await scrapeGlassdoor(testRole, db);
  const endTime = Date.now();
  
  console.log(`\n✅ SCRAPING COMPLETE`);
  console.log(`📊 Time taken: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
  console.log(`📈 New jobs added: ${result}`);
  
  // Check what we actually got
  const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs WHERE source = "glassdoor"').get() as any;
  console.log(`💾 Total Glassdoor jobs in DB: ${totalJobs.count}`);
  
} catch (error: any) {
  console.error(`\n❌ SCRAPING FAILED:`, error.message);
  console.error('Stack:', error.stack);
}

console.log('\n=== TESTING API SCAN ENDPOINT ===');

// Test the API way
try {
  const response = await fetch('http://localhost:3001/api/scan?source=glassdoor');
  const data = await response.json();
  console.log('API Response:', JSON.stringify(data, null, 2));
} catch (error: any) {
  console.error('API Error:', error.message);
}

db.close();
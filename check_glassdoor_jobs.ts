#!/usr/bin/env bun

import { Database } from 'bun:sqlite';

// Initialize database connection
const db = new Database('crystal.db');

console.log('=== CHECKING FOR GLASSDOOR JOBS ===');

// Check specifically for Glassdoor jobs
const glassdoorJobs = db.prepare(`
  SELECT id, title, company, location, url, source, created_at 
  FROM jobs 
  WHERE source = 'glassdoor'
  ORDER BY id DESC 
  LIMIT 20
`).all();

console.log(`\nFound ${glassdoorJobs.length} Glassdoor jobs in database:`);

glassdoorJobs.forEach((job, index) => {
  console.log(`\n--- Glassdoor Job ${index + 1} (ID: ${job.id}) ---`);
  console.log(`Title: "${job.title}"`);
  console.log(`Company: "${job.company}"`);
  console.log(`Location: "${job.location}"`);
  console.log(`URL: "${job.url}"`);
  console.log(`Source: "${job.source}"`);
  console.log(`Created: "${job.created_at}"`);
});

// Check by source breakdown
const sourceBreakdown = db.prepare(`
  SELECT source, COUNT(*) as count 
  FROM jobs 
  GROUP BY source
`).all();

console.log('\n=== JOBS BY SOURCE ===');
sourceBreakdown.forEach((source: any) => {
  console.log(`${source.source || 'null'}: ${source.count} jobs`);
});

// Check role slugs being scraped
const roleBreakdown = db.prepare(`
  SELECT role_slug, COUNT(*) as count 
  FROM jobs 
  GROUP BY role_slug
  ORDER BY count DESC
`).all();

console.log('\n=== JOBS BY ROLE SLUG ===');
roleBreakdown.forEach((role: any) => {
  console.log(`${role.role_slug || 'null'}: ${role.count} jobs`);
});

db.close();
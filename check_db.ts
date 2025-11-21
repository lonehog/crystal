#!/usr/bin/env bun

import { Database } from 'bun:sqlite';

const db = new Database('crystal.db');

// Check current state
const jobs = db.prepare(`
  SELECT id, title, company, location, url 
  FROM jobs 
  ORDER BY id DESC 
  LIMIT 5
`).all();

console.log('=== CURRENT DATABASE STATE ===');
jobs.forEach((job, index) => {
  console.log(`\n--- Job ${index + 1} (ID: ${job.id}) ---`);
  console.log(`Title: "${job.title}"`);
  console.log(`Company: "${job.company}"`);
  console.log(`Location: "${job.location}"`);
  console.log(`URL: "${job.url}"`);
});

// Summary stats
const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
const jobsWithCompany = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE company != 'Unknown'").get() as { count: number };
const jobsWithLocation = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE location != 'Unknown'").get() as { count: number };

console.log('\n=== DATABASE STATISTICS ===');
console.log(`Total jobs: ${totalJobs.count}`);
console.log(`Jobs with company: ${jobsWithCompany.count}`);
console.log(`Jobs with location: ${jobsWithLocation.count}`);

db.close();
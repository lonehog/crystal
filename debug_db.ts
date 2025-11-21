#!/usr/bin/env bun

import { Database } from 'bun:sqlite';

// Initialize database connection
const db = new Database('crystal.db');

// Query recent jobs to examine data structure
const jobs = db.prepare(`
  SELECT id, title, company, location, url, source, created_at 
  FROM jobs 
  ORDER BY id DESC 
  LIMIT 10
`).all();

console.log('=== RECENT JOBS IN DATABASE ===');
jobs.forEach((job, index) => {
  console.log(`\n--- Job ${index + 1} (ID: ${job.id}) ---`);
  console.log(`Title: "${job.title}"`);
  console.log(`Company: "${job.company}"`);
  console.log(`Location: "${job.location}"`);
  console.log(`URL: "${job.url}"`);
  console.log(`Source: "${job.source}"`);
  console.log(`Created: "${job.created_at}"`);
});

// Check if data is actually missing or just not displaying
console.log('\n=== DATABASE STATISTICS ===');
const totalJobs = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as { count: number };
const jobsWithCompany = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE company != 'Unknown' AND company IS NOT NULL").get() as { count: number };
const jobsWithLocation = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE location != 'Unknown' AND location IS NOT NULL").get() as { count: number };
const jobsWithURL = db.prepare("SELECT COUNT(*) as count FROM jobs WHERE url IS NOT NULL AND url != ''").get() as { count: number };

console.log(`Total jobs: ${totalJobs.count}`);
console.log(`Jobs with company: ${jobsWithCompany.count}`);
console.log(`Jobs with location: ${jobsWithLocation.count}`);
console.log(`Jobs with URL: ${jobsWithURL.count}`);

db.close();
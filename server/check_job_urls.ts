import { Database } from 'bun:sqlite';

// Initialize database
const db = new Database('crystal.db');

console.log('🔍 Checking job URLs in database...\n');

// Get sample jobs with their URLs
const jobs = db.prepare('SELECT id, title, company, url, source FROM jobs LIMIT 15').all();

console.log('📋 Sample job URLs:');
jobs.forEach((job: any) => {
  console.log(`ID: ${job.id}`);
  console.log(`Title: ${job.title}`);
  console.log(`Company: ${job.company}`);
  console.log(`URL: ${job.url}`);
  console.log(`Source: ${job.source}`);
  console.log('---');
});

// Analyze URL patterns
console.log('\n📊 URL Pattern Analysis:');
const urlPatterns = new Map<string, number>();
jobs.forEach((job: any) => {
  const url = job.url;
  if (url) {
    if (url.includes('/Job/') || url.includes('/job/')) {
      urlPatterns.set('job-posting', (urlPatterns.get('job-posting') || 0) + 1);
    } else if (url.includes('/cmp/') || url.includes('/company/')) {
      urlPatterns.set('company-profile', (urlPatterns.get('company-profile') || 0) + 1);
    } else {
      urlPatterns.set('other', (urlPatterns.get('other') || 0) + 1);
    }
  }
});

urlPatterns.forEach((count, pattern) => {
  console.log(`${pattern}: ${count} URLs`);
});

db.close();
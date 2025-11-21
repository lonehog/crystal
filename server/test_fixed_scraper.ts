import { Database } from 'bun:sqlite';
import { scrapeStepStone } from './scraper.js';

async function testScraper() {
  console.log('🧪 Testing fixed StepStone scraper...');
  
  // Initialize database
  const db = new Database('crystal.db');
  
  try {
    // Test scraping for a simple role
    console.log('🔍 Starting test scrape for "software engineer"...');
    const result = await scrapeStepStone('software engineer', db);
    console.log(`✅ Test completed! Inserted ${result} jobs.`);
    
    // Check the results
    const jobs = db.prepare('SELECT title, url, source FROM jobs ORDER BY id DESC LIMIT 5').all();
    console.log('\n📋 Latest jobs from test:');
    jobs.forEach((job: any) => {
      console.log(`Title: ${job.title}`);
      console.log(`URL: ${job.url}`);
      console.log(`Source: ${job.source}`);
      console.log('---');
    });
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    db.close();
  }
}

testScraper();
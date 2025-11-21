#!/usr/bin/env bun

import axios from 'axios';
import * as cheerio from 'cheerio';

console.log('=== TESTING GLASSDOOR ACCESS ===');

const roleSlug = 'embedded-systems-engineer';
const url = `https://www.glassdoor.de/Job/deutschland-${roleSlug}-jobs-SRCH_IL.0,11_IN96_KO12,38.htm?fromAge=1`;

console.log(`🔗 Testing URL: ${url}`);

try {
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
      'Accept-Encoding': 'gzip, deflate, br',
      'DNT': '1',
      'Connection': 'keep-alive',
      'Upgrade-Insecure-Requests': '1',
      'Sec-Fetch-Dest': 'document',
      'Sec-Fetch-Mode': 'navigate',
      'Sec-Fetch-Site': 'none',
      'Sec-Fetch-User': '?1',
      'Cache-Control': 'max-age=0',
    },
    timeout: 20000,
  });

  console.log(`📊 Status: ${response.status}`);
  console.log(`📏 Content Length: ${response.data.length} characters`);
  
  const $ = cheerio.load(response.data);
  
  // Check for common error indicators
  const pageTitle = $('title').text().trim();
  console.log(`📄 Page Title: "${pageTitle}"`);
  
  // Check for robots.txt or blocking messages
  const bodyText = $('body').text().toLowerCase();
  if (bodyText.includes('robot') || bodyText.includes('captcha') || bodyText.includes('blocked')) {
    console.log('⚠️  DETECTED: Page may contain robots/captcha/blocking content');
  }
  
  // Look for job listings with various selectors
  const selectors = [
    '[data-test="job-listing"]',
    '.react-job-listing',
    '[class*="JobCard"]',
    '[class*="jobContainer"]',
    '[class*="job-listing"]',
    '.job-listing',
    'article[class*="job"]',
    '[data-test*="job"]'
  ];
  
  console.log('\n🔍 Testing job selectors:');
  selectors.forEach(selector => {
    const count = $(selector).length;
    console.log(`   ${selector}: ${count} elements found`);
  });
  
  // Look for any links that might be job postings
  const jobLinks = $('a[href*="/Job/"], a[href*="/job/"]');
  console.log(`\n🔗 Found ${jobLinks.length} potential job links`);
  
  if (jobLinks.length > 0) {
    console.log('First few job links:');
    jobLinks.slice(0, 5).each((i, el) => {
      const href = $(el).attr('href');
      const text = $(el).text().trim().substring(0, 100);
      console.log(`   ${i + 1}. "${text}" -> ${href}`);
    });
  }
  
  // Check for company names in the page
  const companyElements = $('[data-test*="company"], [class*="company"], [class*="employer"]');
  console.log(`\n🏢 Found ${companyElements.length} potential company elements`);
  
} catch (error: any) {
  console.error(`❌ ERROR: ${error.message}`);
  if (error.response) {
    console.error(`📊 Status: ${error.response.status}`);
    console.error(`📄 Headers:`, error.response.headers);
    
    // Check if it's a blocking response
    const responseText = error.response.data?.toString() || '';
    if (responseText.includes('captcha') || responseText.includes('robot') || responseText.includes('blocked')) {
      console.error('🚫 DETECTED: Glassdoor is blocking/scraping attempts');
    }
  }
}
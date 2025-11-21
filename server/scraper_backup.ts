import axios from 'axios';
import * as cheerio from 'cheerio';
import { Database } from 'bun:sqlite';
import { jobExists, checkJobsExist, getExistingJobsByContent } from './db';

interface JobListing {
  title: string;
  company: string;
  location: string;
  url: string;
  posted_at: string;
  description: string;
  qualifications: string;
  id?: string; // For content-based duplicate detection
}

interface ScrapingStats {
  totalProcessed: number;
  duplicatesFiltered: number;
  newJobsAdded: number;
  errors: number;
  startTime: number;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\+/g, 'plus')
    .replace(/#/g, 'sharp')
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function getRandomUserAgent(): string {
  const userAgents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:122.0) Gecko/20100101 Firefox/122.0'
  ];
  return userAgents[Math.floor(Math.random() * userAgents.length)];
}

function getRandomProxy() {
  // For production use - add proxy list here
  // const proxyList = ['proxy1:port', 'proxy2:port'];
  // return proxyList[Math.floor(Math.random() * proxyList.length)];
  return undefined; // No proxy for development
}

async function scrapeJobDetails(jobUrl: string): Promise<{
  description: string;
  qualifications: string;
}> {
  try {
    const response = await axios.get(jobUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,de;q=0.8',
      },
      timeout: 30000,
    });

    const $ = cheerio.load(response.data);
    
    // Try multiple selectors for job description
    let description = '';
    const descSelectors = [
      '[data-testid="job-description"]',
      '.job-description',
      '[class*="description"]',
      '[class*="job-content"]',
      'section[class*="description"]',
      '.at-section-text',
    ];
    
    for (const selector of descSelectors) {
      const desc = $(selector).first().text().trim();
      if (desc && desc.length > 50) {
        description = desc;
        break;
      }
    }
    
    // Try multiple selectors for qualifications
    let qualifications = '';
    const qualSelectors = [
      '[data-testid="job-qualifications"]',
      '[data-testid="job-requirements"]',
      '.qualifications',
      '.requirements',
      '[class*="qualification"]',
      '[class*="requirement"]',
      'section[class*="qualification"]',
    ];
    
    for (const selector of qualSelectors) {
      const qual = $(selector).first().text().trim();
      if (qual && qual.length > 20) {
        qualifications = qual;
        break;
      }
    }
    
    // Fallback: look for common patterns
    if (!description) {
      $('section, div[class*="content"], div[class*="text"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 200 && (text.includes('description') || text.includes('über') || text.includes('Aufgaben'))) {
          description = text;
          return false;
        }
      });
    }
    
    if (!qualifications) {
      $('section, div[class*="content"], div[class*="text"]').each((_, el) => {
        const text = $(el).text().trim();
        if (text.length > 100 && (text.includes('qualification') || text.includes('Anforderungen') || text.includes('Voraussetzungen'))) {
          qualifications = text;
          return false;
        }
      });
    }

    return { description, qualifications };
  } catch (error: any) {
    console.error(`Error fetching job details from ${jobUrl}:`, error.message);
    return { description: '', qualifications: '' };
  }
}

export async function scrapeStepStone(
  role: string,
  db: Database
): Promise<number> {
  const roleSlug = slugify(role);
  let page = 1;
  let totalInserted = 0;
  let hasMorePages = true;
  
  // Performance tracking
  const stats: ScrapingStats = {
    totalProcessed: 0,
    duplicatesFiltered: 0,
    newJobsAdded: 0,
    errors: 0,
    startTime: Date.now()
  };

  console.log(`🔍 Scraping StepStone for: ${role} (${roleSlug})`);

  while (hasMorePages) {
    const baseUrl = `https://www.stepstone.de/jobs/vollzeit/${roleSlug}?sort=1&action=facet_selected%3bworktypes%3b80001&ag=age_1`;
    const url = page === 1 ? baseUrl : `${baseUrl}&page=${page}`;

    console.log(`📄 Scraping page ${page}...`);

    try {
      // Enhanced delay to avoid rate limiting and bot detection
      const delay = Math.random() * 5000 + 3000; // 3-8 seconds
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Sec-Ch-Ua': '"Chromium";v="120", "Google Chrome";v="120", "Not_A Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Cache-Control': 'max-age=0',
          'Pragma': 'no-cache',
          'Referer': 'https://www.google.com/',
          'Origin': 'https://www.glassdoor.de',
        },
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500;
        },
        maxRedirects: 5,
        withCredentials: true,
        // Add proxy support for production
        // proxy: getRandomProxy()
      });

      // Handle 403 errors specifically
      if (response.status === 403) {
        console.warn(`   [RATE LIMIT] Received 403 for ${url}. Waiting 30 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        // Retry once
        const retryResponse = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          },
          timeout: 20000
        });
        if (retryResponse.status === 403) {
          throw new Error(`Rate limited after retry. Stopping scraping for ${role}.`);
        }
      }

      const $ = cheerio.load(response.data);
      const jobs: JobListing[] = [];

      // StepStone job listing selectors
      $('[data-testid*="job"], .job-item, .job-card, article[class*="job"], [class*="JobCard"]').each(
        (_, element) => {
          const $el = $(element);

          // Enhanced title extraction with better filtering
          let title = $el.find('[data-testid="job-title"], h2, h3, .job-title, a[class*="title"], [class*="JobTitle"]').first().text().trim() ||
                      $el.find('a').first().text().trim();
          
          // Enhanced CSS filtering - handle all StepStone CSS patterns
          if (title && (title.includes('{') || title.includes('res-') || /^[a-zA-Z0-9-_]+\{/.test(title))) {
            // Advanced CSS cleaning for StepStone patterns
            title = title
              .replace(/^\.[a-zA-Z0-9-_]+\{/, '') // Remove leading .res-xxx{
              .replace(/\{[^}]*\}/g, '') // Remove CSS rules
              .replace(/\.[a-zA-Z0-9-_]+\{/g, '') // Remove CSS class definitions
              .replace(/\.[a-zA-Z0-9-_]+/g, '') // Remove remaining CSS classes
              .replace(/@media[^{]*\{[^}]*\}/g, '') // Remove media queries
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim();
            
            // Enhanced fallback: try multiple extraction strategies
            if (title.includes('{') || title.length < 10 || /^[a-zA-Z0-9-_]*$/.test(title)) {
              const parent = $el.closest('article, div[class*="job"], li[class*="job"], tr[class*="job"]');
              const allText = parent.text().trim();
              
              // Multiple keyword patterns for better matching
              const jobKeywords = /(Software\s+(Entwickler|Developer)|Developer|Engineer|Manager|Architect|Consultant|Analyst|Programmierer|Entwickler|Embedded|Aerospace|Hardware|Firmware|Bildverarbeitung|Angular|X\+\+|Dynamics)/i;
              const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 5 && !line.includes('{') && !line.includes('res-'));
              
              for (const line of lines) {
                if (jobKeywords.test(line) && !line.includes('{') && line.length > 10 && !/^[a-zA-Z0-9-_]+$/.test(line)) {
                  title = line;
                  break;
                }
              }
              
              // Last resort: try to extract from link text
              if (title.length < 10) {
                const linkText = $el.find('a').first().text().trim();
                if (linkText && jobKeywords.test(linkText) && !linkText.includes('{')) {
                  title = linkText;
                }
              }
            }
          }

          // Enhanced company extraction with multiple strategies
          let company = 'Unknown';
          
          // Strategy 1: Try common selectors
          const companySelectors = [
            '[data-testid="job-company"]',
            '.company',
            '.employer', 
            '[class*="company"]',
            '[class*="Company"]',
            '[class*="employer"]',
            '[class*="Employer"]'
          ];
          
          for (const selector of companySelectors) {
            const found = $el.find(selector).first().text().trim();
            if (found && found !== 'Unknown' && found.length > 0) {
              company = found;
              break;
            }
          }
          
          // Strategy 2: Look in parent elements
          if (company === 'Unknown') {
            const $parent = $el.closest('article, div[class*="job"], li[class*="job"], tr[class*="job"]');
            const parentCompany = $parent.find('[class*="company"], [class*="employer"]').first().text().trim();
            if (parentCompany && parentCompany.length > 0 && parentCompany !== 'Unknown') {
              company = parentCompany;
            }
          }

          // Enhanced location extraction with multiple strategies  
          let location = 'Unknown';
          
          const locationSelectors = [
            '[data-testid="job-location"]',
            '.location',
            '[class*="location"]',
            '[class*="Location"]',
            '[class*="city"]',
            '[class*="City"]',
            '[class*="place"]',
            '[class*="Place"]'
          ];
          
          for (const selector of locationSelectors) {
            const found = $el.find(selector).first().text().trim();
            if (found && found !== 'Unknown' && found.length > 0) {
              location = found;
              break;
            }
          }
          
          // Strategy 2: Look in parent elements for location
          if (location === 'Unknown') {
            const $parent = $el.closest('article, div[class*="job"], li[class*="job"], tr[class*="job"]');
            const parentLocation = $parent.find('[class*="location"], [class*="city"], [class*="place"]').first().text().trim();
            if (parentLocation && parentLocation.length > 0 && parentLocation !== 'Unknown') {
              location = parentLocation;
            }
          }

          let jobUrl =
            $el.find('a[href*="/stellenangebote/"]').first().attr('href') ||
            $el.find('a[href*="/job/"]').first().attr('href') ||
            $el.find('a[href*="/jobs/"]').first().attr('href') ||
            $el.find('a').first().attr('href') ||
            '';

          // Filter out company profile URLs and get actual job posting URLs
          if (jobUrl && jobUrl.includes('/cmp/de/')) {
            // This is a company profile URL, not a job posting - skip this element
            return;
          }

          // Make URL absolute if relative
          if (jobUrl && !jobUrl.startsWith('http')) {
            jobUrl = `https://www.stepstone.de${jobUrl}`;
          }

          // Strategy 3: Extract company from URL if still unknown
          if (company === 'Unknown' && jobUrl && jobUrl.includes('/cmp/de/')) {
            const companyMatch = jobUrl.match(/\/cmp\/de\/([^\/]+)/);
            if (companyMatch) {
              const companySlug = companyMatch[1];
              company = decodeURIComponent(companySlug)
                .replace(/-/g, ' ')
                .replace(/\b\w/g, l => l.toUpperCase());
            }
          }

          const postedAt =
            $el.find('[data-testid="job-date"], .date, [class*="date"], time').first().text().trim() ||
            new Date().toISOString();

          if (title && jobUrl) {
            jobs.push({
              title,
              company,
              location,
              url: jobUrl,
              posted_at: postedAt,
              description: '',
              qualifications: '',
            });
          }
        }
      );

      // Fallback: try to find any job links if the above doesn't work
      if (jobs.length === 0) {
        $('a[href*="/stellenangebote/"], a[href*="/job/"]').each(
          (_, element) => {
            const $el = $(element);
            let title = $el.text().trim();
            const jobUrl = $el.attr('href') || '';

            // Clean up CSS-embedded titles - extract actual job title
            // Remove CSS properties and keep only the actual job title at the end
            const cssPattern = /^.*?}[^}]*}(.+)$/;
            const match = title.match(cssPattern);
            if (match && match[1]) {
              title = match[1].trim();
            }
            
            // Filter out pure CSS content, very short titles, and company profile URLs
            if (title.includes('box-sizing') || title.includes('font-family') || title.length < 5) {
              return; // Skip this element
            }

            // Filter out company profile URLs
            if (jobUrl && jobUrl.includes('/cmp/de/')) {
              return; // Skip company profile URLs
            }

            if (title && jobUrl && title.length > 5) {
              const fullUrl = jobUrl.startsWith('http')
                ? jobUrl
                : `https://www.stepstone.de${jobUrl}`;

              // Try to find company and location from parent elements
              const $parent = $el.closest('article, div[class*="job"], div[class*="listing"]');
              const company =
                $parent.find('[class*="company"], [class*="employer"]').first().text().trim() ||
                'Unknown';
              const location =
                $parent.find('[class*="location"], [class*="city"]').first().text().trim() ||
                'Unknown';

              jobs.push({
                title,
                company,
                location,
                url: fullUrl,
                posted_at: new Date().toISOString(),
                description: '',
                qualifications: '',
              });
            }
          }
        );
      }

      // If no jobs found on this page, stop pagination
      if (jobs.length === 0) {
        console.log(`🛑 StepStone: No jobs found on page ${page}. Stopping pagination.`);
        hasMorePages = false;
        break;
      }

      // Log job titles found
      console.log(`📋 Found ${jobs.length} jobs on page ${page}. Titles:`);
      jobs.forEach(job => console.log(`   - ${job.title}`));

      // Advanced duplicate detection using multiple strategies
      const urls = jobs.map(job => job.url);
      const existingUrls = checkJobsExist(db, urls);
      
      // Strategy 1: URL-based duplicate detection
      let newJobs = jobs.filter(job => !existingUrls.has(job.url));
      let urlDuplicates = jobs.length - newJobs.length;
      
      // Strategy 2: Content-based duplicate detection (title + company + location)
      if (newJobs.length > 0) {
        const contentKeys = getExistingJobsByContent(db, newJobs.map(job => ({
          title: job.title,
          company: job.company,
          location: job.location
        })));
        
        const beforeContentFilter = newJobs.length;
        newJobs = newJobs.filter(job => {
          const key = `${job.title}|${job.company}|${job.location}`;
          return !contentKeys.has(key);
        });
        const contentDuplicates = beforeContentFilter - newJobs.length;
        urlDuplicates += contentDuplicates;
      }
      
      stats.totalProcessed += jobs.length;
      stats.duplicatesFiltered += urlDuplicates;
      
      if (urlDuplicates > 0) {
        console.log(`   [OPTIMIZED] Skipping detail fetch for ${urlDuplicates} duplicate jobs (${jobs.length - newJobs.length} URL + content matches).`);
      }

      if (newJobs.length > 0) {
        // Scrape job details for new jobs using batched concurrency
        console.log(`📋 Fetching details for ${newJobs.length} NEW jobs (concurrently)...`);
        const BATCH_SIZE = 5;
        for (let i = 0; i < newJobs.length; i += BATCH_SIZE) {
          const batch = newJobs.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (job) => {
              const details = await scrapeJobDetails(job.url);
              job.description = details.description;
              job.qualifications = details.qualifications;
            })
          );
          // Introduce a small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < newJobs.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Insert jobs into database using individual inserts (bun:sqlite compatible)
      let pageInserted = 0;
      
      if (newJobs.length > 0) {
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO jobs (title, company, location, url, posted_at, role_slug, description, qualifications, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const job of newJobs) {
          try {
            const result = insertStmt.run(
              job.title,
              job.company,
              job.location,
              job.url,
              job.posted_at,
              roleSlug,
              job.description,
              job.qualifications,
              'stepstone'
            );
            
            // Check if insertion was successful (INSERT OR IGNORE doesn't throw on duplicates)
            if (result.changes > 0) {
              pageInserted++;
            }
          } catch (error: any) {
            console.error(`   [DB ERROR] Failed to insert job ${job.title}:`, error.message);
          }
        }
      }
      
      // Log duplicates that were filtered out
      jobs.filter(job => !newJobs.includes(job)).forEach(job => {
        console.log(`   [DUPLICATE] Job ignored: ${job.title} (${job.url})`);
      });

      totalInserted += pageInserted;
      stats.newJobsAdded += pageInserted;
      console.log(`✅ Page ${page}: Found ${jobs.length} jobs, inserted ${pageInserted} new ones`);
      
      // Performance logging every 5 pages
      if (page % 5 === 0) {
        const elapsedTime = Date.now() - stats.startTime;
        const jobsPerSecond = (stats.totalProcessed / (elapsedTime / 1000)).toFixed(2);
        console.log(`   [STATS] Processed: ${stats.totalProcessed}, Duplicates: ${stats.duplicatesFiltered}, Speed: ${jobsPerSecond} jobs/sec`);
      }

      // Check if there's a next page
      const nextPageLink = $('a[class*="next"], a[class*="pagination"], [aria-label*="next"], [aria-label*="Next"]').first();
      const hasNextPage = nextPageLink.length > 0 && !nextPageLink.hasClass('disabled');
      
      // Also check for pagination indicators
      const paginationText = $('[class*="pagination"], [class*="Pagination"]').text();
      const maxPageMatch = paginationText.match(/(\d+)\s*(?:of|von|\/)\s*(\d+)/i);
      
      if (maxPageMatch) {
        const currentPage = parseInt(maxPageMatch[1]);
        const maxPage = parseInt(maxPageMatch[2]);
        hasMorePages = currentPage < maxPage;
      } else if (!hasNextPage && page >= 1) {
        // If we got jobs but no next page indicator, try one more page
        hasMorePages = page < 10; // Safety limit: max 10 pages
      }

      page++;
      
      // Safety limit: don't scrape more than 20 pages
      if (page > 20) {
        console.log(`🛑 StepStone: Reached safety limit of 20 pages. Stopping pagination.`);
        hasMorePages = false;
      }

      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Error scraping page ${page} for ${role}:`, error.message);
      stats.errors++;
      hasMorePages = false;
    }
  }

  // Final performance report
  const totalTime = Date.now() - stats.startTime;
  const jobsPerSecond = (stats.totalProcessed / (totalTime / 1000)).toFixed(2);
  const duplicateRate = ((stats.duplicatesFiltered / stats.totalProcessed) * 100).toFixed(1);
  
  console.log(`✅ COMPLETE: StepStone for ${role}`);
  console.log(`   [PERFORMANCE] Time: ${(totalTime/1000).toFixed(1)}s, Speed: ${jobsPerSecond} jobs/sec`);
  console.log(`   [FILTERING] Processed: ${stats.totalProcessed}, Duplicates: ${stats.duplicatesFiltered} (${duplicateRate}%)`);
  console.log(`   [RESULTS] Inserted: ${totalInserted} new jobs`);
  
  return totalInserted;
}

export async function scrapeGlassdoor(
  role: string,
  db: Database
): Promise<number> {
  const roleSlug = slugify(role);
  let page = 1;
  let totalInserted = 0;
  let hasMorePages = true;
  
  // Performance tracking
  const stats: ScrapingStats = {
    totalProcessed: 0,
    duplicatesFiltered: 0,
    newJobsAdded: 0,
    errors: 0,
    startTime: Date.now()
  };

  console.log(`🔍 Scraping Glassdoor for: ${role} (${roleSlug})`);

  while (hasMorePages) {
    const baseUrl = `https://www.glassdoor.de/Job/deutschland-${roleSlug}-jobs-SRCH_IL.0,11_IN96_KO12,38.htm?fromAge=1`;
    const url = page === 1 ? baseUrl : `${baseUrl}&p=${page}`;

    console.log(`📄 Scraping Glassdoor page ${page}...`);

    try {
      // Enhanced delay to avoid rate limiting and bot detection
      const delay = Math.random() * 5000 + 3000; // 3-8 seconds
      await new Promise(resolve => setTimeout(resolve, delay));
      
      const response = await axios.get(url, {
        headers: {
          'User-Agent': getRandomUserAgent(),
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
          'Accept-Language': 'de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Sec-Ch-Ua': '"Chromium";v="120", "Google Chrome";v="120", "Not_A Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Cache-Control': 'max-age=0',
          'Pragma': 'no-cache',
          'Referer': 'https://www.google.com/',
          'Origin': 'https://www.glassdoor.de',
        },
        timeout: 30000,
        validateStatus: function (status) {
          return status < 500;
        },
        maxRedirects: 5,
        withCredentials: true,
        // Add proxy support for production
        // proxy: getRandomProxy()
      });

      // Handle 403 errors specifically
      if (response.status === 403) {
        console.warn(`   [RATE LIMIT] Received 403 for ${url}. Waiting 30 seconds...`);
        await new Promise(resolve => setTimeout(resolve, 30000));
        // Retry once
        const retryResponse = await axios.get(url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
          },
          timeout: 20000
        });
        if (retryResponse.status === 403) {
          throw new Error(`Rate limited after retry. Stopping scraping for ${role}.`);
        }
      }

      const $ = cheerio.load(response.data);
      const jobs: JobListing[] = [];

      // Glassdoor job listing selectors
      $('[data-test="job-listing"], .react-job-listing, [class*="JobCard"], [class*="jobContainer"]').each(
        (_, element) => {
          const $el = $(element);

          // Enhanced title extraction with better filtering
          let title = $el.find('[data-test="job-title"], h2, h3, a[class*="jobTitle"], [class*="JobTitle"]').first().text().trim() ||
                      $el.find('a').first().text().trim();
          
          // Enhanced CSS filtering - handle all StepStone CSS patterns
          if (title && (title.includes('{') || title.includes('res-') || /^[a-zA-Z0-9-_]+\{/.test(title))) {
            // Advanced CSS cleaning for StepStone patterns
            title = title
              .replace(/^\.[a-zA-Z0-9-_]+\{/, '') // Remove leading .res-xxx{
              .replace(/\{[^}]*\}/g, '') // Remove CSS rules
              .replace(/\.[a-zA-Z0-9-_]+\{/g, '') // Remove CSS class definitions
              .replace(/\.[a-zA-Z0-9-_]+/g, '') // Remove remaining CSS classes
              .replace(/@media[^{]*\{[^}]*\}/g, '') // Remove media queries
              .replace(/\s+/g, ' ') // Normalize whitespace
              .trim();
            
            // Enhanced fallback: try multiple extraction strategies
            if (title.includes('{') || title.length < 10 || /^[a-zA-Z0-9-_]*$/.test(title)) {
              const parent = $el.closest('article, div[class*="job"], li[class*="job"], tr[class*="job"]');
              const allText = parent.text().trim();
              
              // Multiple keyword patterns for better matching
              const jobKeywords = /(Software\s+(Entwickler|Developer)|Developer|Engineer|Manager|Architect|Consultant|Analyst|Programmierer|Entwickler|Embedded|Aerospace|Hardware|Firmware|Bildverarbeitung|Angular|X\+\+|Dynamics)/i;
              const lines = allText.split('\n').map(line => line.trim()).filter(line => line.length > 5 && !line.includes('{') && !line.includes('res-'));
              
              for (const line of lines) {
                if (jobKeywords.test(line) && !line.includes('{') && line.length > 10 && !/^[a-zA-Z0-9-_]+$/.test(line)) {
                  title = line;
                  break;
                }
              }
              
              // Last resort: try to extract from link text
              if (title.length < 10) {
                const linkText = $el.find('a').first().text().trim();
                if (linkText && jobKeywords.test(linkText) && !linkText.includes('{')) {
                  title = linkText;
                }
              }
            }
          }

          // Try multiple selector patterns for company
          const company =
            $el.find('[data-test="employer-name"], [class*="employerName"], [class*="company"]').first().text().trim() ||
            'Unknown';

          // Try multiple selector patterns for location
          const location =
            $el.find('[data-test="job-location"], [class*="location"], [class*="jobLocation"]').first().text().trim() ||
            'Unknown';

          let jobUrl =
            $el.find('a[href*="/Job/"], a[href*="/job/"]').first().attr('href') ||
            $el.find('a').first().attr('href') ||
            '';

          // Make URL absolute if relative
          if (jobUrl && !jobUrl.startsWith('http')) {
            jobUrl = `https://www.glassdoor.de${jobUrl}`;
          }

          const postedAt =
            $el.find('[data-test="job-age"], [class*="jobAge"], [class*="date"]').first().text().trim() ||
            new Date().toISOString();

          if (title && jobUrl) {
            jobs.push({
              title,
              company,
              location,
              url: jobUrl,
              posted_at: postedAt,
              description: '',
              qualifications: '',
            });
          }
        }
      );

      // Fallback: try to find any job links if the above doesn't work
      if (jobs.length === 0) {
        $('a[href*="/Job/"], a[href*="/job/"]').each(
          (_, element) => {
            const $el = $(element);
            const title = $el.text().trim();
            const jobUrl = $el.attr('href') || '';

            if (title && jobUrl && title.length > 10) {
              const fullUrl = jobUrl.startsWith('http')
                ? jobUrl
                : `https://www.glassdoor.de${jobUrl}`;

              // Try to find company and location from parent elements
              const $parent = $el.closest('[class*="job"], [class*="listing"], article');
              const company =
                $parent.find('[class*="company"], [class*="employer"]').first().text().trim() ||
                'Unknown';
              const location =
                $parent.find('[class*="location"], [class*="city"]').first().text().trim() ||
                'Unknown';

              jobs.push({
                title,
                company,
                location,
                url: fullUrl,
                posted_at: new Date().toISOString(),
                description: '',
                qualifications: '',
              });
            }
          }
        );
      }

      // If no jobs found on this page, stop pagination
      if (jobs.length === 0) {
        console.log(`🛑 Glassdoor: No jobs found on page ${page}. Stopping pagination.`);
        hasMorePages = false;
        break;
      }

      // Log job titles found
      console.log(`📋 Found ${jobs.length} jobs on Glassdoor page ${page}. Titles:`);
      jobs.forEach(job => console.log(`   - ${job.title}`));

      // Advanced duplicate detection using multiple strategies
      const urls = jobs.map(job => job.url);
      const existingUrls = checkJobsExist(db, urls);
      
      // Strategy 1: URL-based duplicate detection
      let newJobs = jobs.filter(job => !existingUrls.has(job.url));
      let urlDuplicates = jobs.length - newJobs.length;
      
      // Strategy 2: Content-based duplicate detection (title + company + location)
      if (newJobs.length > 0) {
        const contentKeys = getExistingJobsByContent(db, newJobs.map(job => ({
          title: job.title,
          company: job.company,
          location: job.location
        })));
        
        const beforeContentFilter = newJobs.length;
        newJobs = newJobs.filter(job => {
          const key = `${job.title}|${job.company}|${job.location}`;
          return !contentKeys.has(key);
        });
        const contentDuplicates = beforeContentFilter - newJobs.length;
        urlDuplicates += contentDuplicates;
      }
      
      stats.totalProcessed += jobs.length;
      stats.duplicatesFiltered += urlDuplicates;
      
      if (urlDuplicates > 0) {
        console.log(`   [OPTIMIZED] Skipping Glassdoor detail fetch for ${urlDuplicates} duplicate jobs (${jobs.length - newJobs.length} URL + content matches).`);
      }

      if (newJobs.length > 0) {
        // Scrape job details for new jobs using batched concurrency
        console.log(`📋 Fetching Glassdoor details for ${newJobs.length} NEW jobs (concurrently)...`);
        const BATCH_SIZE = 5;
        for (let i = 0; i < newJobs.length; i += BATCH_SIZE) {
          const batch = newJobs.slice(i, i + BATCH_SIZE);
          await Promise.all(
            batch.map(async (job) => {
              const details = await scrapeJobDetails(job.url);
              job.description = details.description;
              job.qualifications = details.qualifications;
            })
          );
          // Introduce a small delay between batches to avoid rate limiting
          if (i + BATCH_SIZE < newJobs.length) {
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Insert jobs into database using individual inserts (bun:sqlite compatible)
      let pageInserted = 0;
      let duplicateCount = 0;
      let errorCount = 0;
      
      if (newJobs.length > 0) {
        const insertStmt = db.prepare(`
          INSERT OR IGNORE INTO jobs (title, company, location, url, posted_at, role_slug, description, qualifications, source)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        for (const job of newJobs) {
          try {
            const result = insertStmt.run(
              job.title,
              job.company,
              job.location,
              job.url,
              job.posted_at,
              roleSlug,
              job.description,
              job.qualifications,
              'glassdoor'
            );
            
            // Check if insertion was successful (INSERT OR IGNORE doesn't throw on duplicates)
            if (result.changes > 0) {
              pageInserted++;
              console.log(`   [INSERTED] ${job.title} at ${job.company} (role: ${roleSlug})`);
            } else {
              duplicateCount++;
              console.log(`   [DUPLICATE] Skipped: ${job.title} at ${job.company}`);
            }
          } catch (error: any) {
            errorCount++;
            console.error(`   [DB ERROR] Failed to insert job ${job.title}:`, error.message);
          }
        }
        
        // DEBUG: Check database state after insertion
        const countStmt = db.prepare(`SELECT COUNT(*) as count FROM jobs WHERE role_slug = ? AND source = 'glassdoor'`);
        const jobCount = countStmt.get(roleSlug) as any;
        console.log(`   [DEBUG] Total glassdoor jobs in DB for role '${roleSlug}': ${jobCount.count}`);
      }
      
      // Log duplicates that were filtered out
      jobs.filter(job => !newJobs.includes(job)).forEach(job => {
        console.log(`   [DUPLICATE] Job ignored: ${job.title} (${job.url})`);
      });

      totalInserted += pageInserted;
      stats.newJobsAdded += pageInserted;
      console.log(`✅ Glassdoor Page ${page}: Found ${jobs.length} jobs, inserted ${pageInserted} new ones`);
      
      // Performance logging every 5 pages
      if (page % 5 === 0) {
        const elapsedTime = Date.now() - stats.startTime;
        const jobsPerSecond = (stats.totalProcessed / (elapsedTime / 1000)).toFixed(2);
        console.log(`   [STATS] Processed: ${stats.totalProcessed}, Duplicates: ${stats.duplicatesFiltered}, Speed: ${jobsPerSecond} jobs/sec`);
      }

      // Check if there's a next page
      const nextPageLink = $('button[aria-label*="Next"], a[aria-label*="Next"], [class*="nextButton"]').first();
      const hasNextPage = nextPageLink.length > 0 && !nextPageLink.hasClass('disabled') && !nextPageLink.prop('disabled');
      
      // Also check for pagination indicators
      const paginationText = $('[class*="pagination"], [class*="Pagination"]').text();
      const maxPageMatch = paginationText.match(/(\d+)\s*(?:of|von|\/)\s*(\d+)/i);
      
      if (maxPageMatch) {
        const currentPage = parseInt(maxPageMatch[1]);
        const maxPage = parseInt(maxPageMatch[2]);
        hasMorePages = currentPage < maxPage;
      } else if (!hasNextPage && page >= 1) {
        // If we got jobs but no next page indicator, try one more page
        hasMorePages = page < 10; // Safety limit: max 10 pages
      }

      page++;
      
      // Safety limit: don't scrape more than 20 pages
      if (page > 20) {
        console.log(`🛑 Glassdoor: Reached safety limit of 20 pages. Stopping pagination.`);
        hasMorePages = false;
      }

      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Error scraping Glassdoor page ${page} for ${role}:`, error.message);
      stats.errors++;
      hasMorePages = false;
    }
  }

  // Final performance report
  const totalTime = Date.now() - stats.startTime;
  const jobsPerSecond = (stats.totalProcessed / (totalTime / 1000)).toFixed(2);
  const duplicateRate = ((stats.duplicatesFiltered / stats.totalProcessed) * 100).toFixed(1);
  
  console.log(`✅ COMPLETE: Glassdoor for ${role}`);
  console.log(`   [PERFORMANCE] Time: ${(totalTime/1000).toFixed(1)}s, Speed: ${jobsPerSecond} jobs/sec`);
  console.log(`   [FILTERING] Processed: ${stats.totalProcessed}, Duplicates: ${stats.duplicatesFiltered} (${duplicateRate}%)`);
  console.log(`   [RESULTS] Inserted: ${totalInserted} new jobs`);
  
  return totalInserted;
}

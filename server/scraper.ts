import axios from 'axios';
import * as cheerio from 'cheerio';
import { Database } from 'bun:sqlite';

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

  console.log(`🔍 Scraping StepStone for: ${role} (${roleSlug})`);

  while (hasMorePages) {
    const baseUrl = `https://www.stepstone.de/jobs/vollzeit/${roleSlug}?sort=1&action=facet_selected%3bworktypes%3b80001&ag=age_1`;
    const url = page === 1 ? baseUrl : `${baseUrl}&page=${page}`;

    console.log(`📄 Scraping page ${page}...`);

    try {
      const response = await axios.get(url, {
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
      const jobs: Array<{
        title: string;
        company: string;
        location: string;
        url: string;
        posted_at: string;
        description: string;
        qualifications: string;
      }> = [];

      // StepStone job listing selectors
      $('[data-testid*="job"], .job-item, .job-card, article[class*="job"], [class*="JobCard"]').each(
        (_, element) => {
          const $el = $(element);

          // Try multiple selector patterns for title
          const title =
            $el.find('[data-testid="job-title"], h2, h3, .job-title, a[class*="title"], [class*="JobTitle"]').first().text().trim() ||
            $el.find('a').first().text().trim();

          // Try multiple selector patterns for company
          const company =
            $el.find('[data-testid="job-company"], .company, .employer, [class*="company"], [class*="Company"]').first().text().trim() ||
            'Unknown';

          // Try multiple selector patterns for location
          const location =
            $el.find('[data-testid="job-location"], .location, [class*="location"], [class*="Location"]').first().text().trim() ||
            'Unknown';

          let jobUrl =
            $el.find('a[href*="/stellenangebote/"], a[href*="/jobs/"]').first().attr('href') ||
            $el.find('a').first().attr('href') ||
            '';

          // Make URL absolute if relative
          if (jobUrl && !jobUrl.startsWith('http')) {
            jobUrl = `https://www.stepstone.de${jobUrl}`;
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
        $('a[href*="/stellenangebote/"], a[href*="/jobs/"]').each(
          (_, element) => {
            const $el = $(element);
            const title = $el.text().trim();
            const jobUrl = $el.attr('href') || '';

            if (title && jobUrl && title.length > 10) {
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
        hasMorePages = false;
        break;
      }

      // Scrape job details for each job
      console.log(`📋 Fetching details for ${jobs.length} jobs...`);
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const details = await scrapeJobDetails(job.url);
        job.description = details.description;
        job.qualifications = details.qualifications;
        
        // Small delay to avoid rate limiting
        if (i < jobs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Insert jobs into database
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO jobs (title, company, location, url, posted_at, role_slug, description, qualifications, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let pageInserted = 0;
      for (const job of jobs) {
        try {
          insertStmt.run(
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
          pageInserted++;
        } catch (error) {
          // Ignore duplicate URL errors
        }
      }

      totalInserted += pageInserted;
      console.log(`✅ Page ${page}: Found ${jobs.length} jobs, inserted ${pageInserted} new ones`);

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
        hasMorePages = false;
      }

      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Error scraping page ${page} for ${role}:`, error.message);
      hasMorePages = false;
    }
  }

  console.log(`✅ Total: Inserted ${totalInserted} new jobs for ${role} from StepStone`);
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

  console.log(`🔍 Scraping Glassdoor for: ${role} (${roleSlug})`);

  while (hasMorePages) {
    const baseUrl = `https://www.glassdoor.de/Job/deutschland-${roleSlug}-jobs-SRCH_IL.0,11_IN96_KO12,38.htm?fromAge=1`;
    const url = page === 1 ? baseUrl : `${baseUrl}&p=${page}`;

    console.log(`📄 Scraping Glassdoor page ${page}...`);

    try {
      const response = await axios.get(url, {
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
      const jobs: Array<{
        title: string;
        company: string;
        location: string;
        url: string;
        posted_at: string;
        description: string;
        qualifications: string;
      }> = [];

      // Glassdoor job listing selectors
      $('[data-test="job-listing"], .react-job-listing, [class*="JobCard"], [class*="jobContainer"]').each(
        (_, element) => {
          const $el = $(element);

          // Try multiple selector patterns for title
          const title =
            $el.find('[data-test="job-title"], h2, h3, a[class*="jobTitle"], [class*="JobTitle"]').first().text().trim() ||
            $el.find('a').first().text().trim();

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
        hasMorePages = false;
        break;
      }

      // Scrape job details for each job
      console.log(`📋 Fetching Glassdoor details for ${jobs.length} jobs...`);
      for (let i = 0; i < jobs.length; i++) {
        const job = jobs[i];
        const details = await scrapeJobDetails(job.url);
        job.description = details.description;
        job.qualifications = details.qualifications;
        
        // Small delay to avoid rate limiting
        if (i < jobs.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      }

      // Insert jobs into database
      const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO jobs (title, company, location, url, posted_at, role_slug, description, qualifications, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      let pageInserted = 0;
      for (const job of jobs) {
        try {
          insertStmt.run(
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
          pageInserted++;
        } catch (error) {
          // Ignore duplicate URL errors
        }
      }

      totalInserted += pageInserted;
      console.log(`✅ Glassdoor Page ${page}: Found ${jobs.length} jobs, inserted ${pageInserted} new ones`);

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
        hasMorePages = false;
      }

      // Small delay between pages
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error: any) {
      console.error(`❌ Error scraping Glassdoor page ${page} for ${role}:`, error.message);
      hasMorePages = false;
    }
  }

  console.log(`✅ Total: Inserted ${totalInserted} new jobs for ${role} from Glassdoor`);
  return totalInserted;
}

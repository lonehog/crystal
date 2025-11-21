import { Database } from 'bun:sqlite';

// Initialize database
const db = new Database('crystal.db');

console.log('📝 Adding sample jobs for testing...');

const sampleJobs = [
  {
    title: 'Embedded Software Engineer (m/w/d)',
    company: 'Siemens AG',
    location: 'München, Deutschland',
    url: 'https://www.stepstone.de/jobs/embedded-software-engineer-siemens-muenchen',
    description: 'Entwicklung von Embedded Software für industrielle Automatisierungssysteme. Erfahrung mit C/C++, Linux und ARM-Mikrocontrollern erforderlich.',
    qualifications: 'Bachelor in Informatik oder Elektrotechnik, 3+ Jahre Erfahrung in Embedded Development, Kenntnisse in C/C++, Linux, ARM'
  },
  {
    title: 'Firmware Developer Automotive',
    company: 'BMW Group',
    location: 'München, Deutschland',
    url: 'https://www.stepstone.de/jobs/firmware-developer-bmw-automotive',
    description: 'Entwicklung von Firmware für BMW Fahrzeugsteuergeräte. Schwerpunkt auf AUTOSAR, CAN-Bus und Real-Time Systems.',
    qualifications: 'Master in Informatik/Elektrotechnik, Automotive Erfahrung, AUTOSAR Kenntnisse, CAN-Bus Erfahrung'
  },
  {
    title: 'Embedded Systems Engineer',
    company: 'Bosch Rexroth AG',
    location: 'Stuttgart, Deutschland',
    url: 'https://www.stepstone.de/jobs/embedded-systems-engineer-bosch-rexroth',
    description: 'Entwicklung von Embedded Software für hydraulische Antriebssysteme. STM32, FreeRTOS und industriales Ethernet.',
    qualifications: 'Diplom/Bachelor, Embedded C, STM32, FreeRTOS, Ethernet, IEC 61131'
  },
  {
    title: 'Senior Embedded Developer (m/f/d)',
    company: 'Continental AG',
    location: 'Frankfurt am Main, Deutschland',
    url: 'https://www.stepstone.de/jobs/senior-embedded-developer-continental',
    description: 'Lead-Entwicklung für Embedded Software in Automotive ECU Projekten. Agile Entwicklung in internationalen Teams.',
    qualifications: '5+ Jahre Embedded Erfahrung, Team Lead Erfahrung, C/C++, AUTOSAR, Automotive Protokolle'
  },
  {
    title: 'IoT Embedded Software Engineer',
    company: 'Infineon Technologies AG',
    location: 'München, Deutschland', 
    url: 'https://www.stepstone.de/jobs/iot-embedded-software-engineer-infineon',
    description: 'Entwicklung von Embedded Software für IoT Sensoren und Mikrocontroller. Fokus auf Low-Power Design und Wireless Konnektivität.',
    qualifications: 'Bachelor/Master, IoT Erfahrung, Low-Power Design, BLE/WiFi, ARM Cortex-M'
  }
];

const insertStmt = db.prepare(`
  INSERT OR IGNORE INTO jobs (title, company, location, url, posted_at, role_slug, description, qualifications, source)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

let inserted = 0;
for (const job of sampleJobs) {
  try {
    const result = insertStmt.run(
      job.title,
      job.company,
      job.location,
      job.url,
      new Date().toISOString(),
      'embedded-software-engineer',
      job.description,
      job.qualifications,
      'stepstone'
    );
    
    if (result.changes > 0) {
      inserted++;
      console.log(`✅ Added: ${job.title} at ${job.company}`);
    }
  } catch (error: any) {
    console.error(`❌ Failed to add ${job.title}:`, error.message);
  }
}

console.log(`\n📊 Successfully added ${inserted} sample jobs`);

// Verify
const count = db.prepare('SELECT COUNT(*) as count FROM jobs').get() as any;
console.log(`📋 Total jobs in database: ${count.count}`);

db.close();
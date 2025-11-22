# Crystal - Job Portal
A production-ready job aggregation dashboard built with Bun 1.3, featuring a stunning glassmorphic UI.

## Features

- 🔍 **StepStone.de Scraping**: Automatically scrapes job listings from StepStone.de
- 📊 **Real-time Dashboard**: Monitor job statistics with beautiful charts
- 🎨 **Glassmorphic UI**: Futuristic design with ambient orbs and glass effects
- ⚡ **Bun Native**: Uses Bun's native TypeScript execution and SQLite
- 🔄 **Auto-scanning**: Hourly cron jobs for automatic updates
- 📱 **Responsive**: Works beautifully on all screen sizes

## Tech Stack

- **Runtime**: Bun 1.3
- **Frontend**: React, TypeScript, Vite, Tailwind CSS, Framer Motion, Recharts
- **Backend**: Express, Axios, Cheerio, node-cron, bun:sqlite
- **Package Manager**: Bun

## Getting Started

### Prerequisites

- Bun 1.3+ installed ([getbun.sh](https://bun.sh))

### Installation

1. Install dependencies:
```bash
bun install
```

2. Start development servers:
```bash
bun run dev
```

This will start:
- Server on `http://localhost:3001`
- Client on `http://localhost:5173`

### First Steps

1. Open `http://localhost:5173` in your browser
2. Navigate to **Settings**
3. Add job roles (e.g., "Embedded Engineer", "C++ Developer")
4. Click **Force Scan Now** to scrape jobs
5. View results in **Job Feed** and statistics in **Dashboard**

## Project Structure

```
crystal/
├── server/          # Backend API
│   ├── index.ts     # Express server & routes
│   ├── db.ts        # SQLite initialization
│   └── scraper.ts   # StepStone scraping logic
├── client/          # Frontend React app
│   └── src/
│       ├── pages/   # Dashboard, Feed, Settings
│       ├── components/ # Reusable UI components
│       └── lib/     # API client
└── package.json     # Root workspace config
```

## API Endpoints

- `GET /api/jobs` - Get all jobs (optional `?role=slug&limit=100`)
- `GET /api/stats` - Get dashboard statistics
- `GET /api/roles` - Get active job roles
- `POST /api/roles` - Add a new role (`{ role: string }`)
- `DELETE /api/roles/:role` - Remove a role
- `GET /api/scan` - Trigger immediate scan

## Database

Uses `bun:sqlite` with two tables:
- `jobs`: Job listings with title, company, location, URL, etc.
- `settings`: Key-value store for active roles

Database file: `crystal.db` (created automatically)

## Design System

- **Background**: Deep Navy (`#0B1120`)
- **Glass Cards**: `bg-gray-900/40`, `backdrop-blur-xl`, `border-white/10`
- **Accent Color**: Electric Blue (`#0075FF`)
- **Typography**: Inter font family

## License

MIT


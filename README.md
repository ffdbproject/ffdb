<div align="center">

# Flora and Fauna Database of Bangladesh (FFDB)

**A comprehensive, open-source biodiversity database for Bangladesh.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-22+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[Live Demo](https://ffdb.bd) · [API Docs](https://ffdb.bd/api-docs) · [Report Bug](https://github.com/ffdbproject/ffdb/issues) · [Contribute Data](https://ffdb.bd/contribute)

</div>

---

## Screenshots

_Screenshots coming soon — or submit a PR with your own!_

---

## Features

- **Species Database** — Browse, search, and filter 1000+ species of flora & fauna native to Bangladesh
- **Bilingual Support** — English and Bengali (বাংলা) names for every species
- **IUCN Conservation Status** — All 10 official IUCN categories (EX, EW, RE, CR, EN, VU, NT, LC, DD, NE) with color-coded badges
- **Taxonomic Classification** — Full hierarchy: Kingdom → Phylum → Class → Order → Family → Genus
- **Interactive Maps** — Leaflet-powered geographic location mapping for each species
- **Image Gallery** — Multi-image support with lightbox viewer, zoom, and swipe gestures
- **External Links** — Direct links to Wikipedia, IUCN Red List, GBIF, EOL, and iNaturalist
- **Data Enrichment** — One-click enrichment from Wikipedia and GBIF APIs to auto-fill taxonomy, descriptions, images, and external links
- **Public API** — RESTful JSON API with full documentation at `/api-docs`
- **Community Contributions** — Public submission form for species data (admin-reviewed before publishing)
- **Admin Dashboard** — Full CRUD management, bulk enrichment, team management, report tracking, and database import/export
- **SEO Optimized** — Server-rendered meta tags, JSON-LD structured data, Open Graph, sitemap, and robots.txt
- **Responsive Design** — Beautiful, modern UI that works on desktop, tablet, and mobile
- **Cookie Consent** — GDPR-style cookie consent banner
- **404 Page** — Nature-themed "Lost in the Wilderness" page for invalid URLs

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | React 19, React Router 7, Vite 5 |
| **Styling** | Vanilla CSS with design tokens |
| **Maps** | Leaflet + React-Leaflet |
| **Backend** | Node.js, Express 5 |
| **Database** | PostgreSQL 15+ |
| **Image Processing** | Sharp |
| **Security** | Helmet, HPP, CORS, Rate Limiting, sanitize-html |
| **SEO** | react-helmet-async, JSON-LD, prerender middleware |

---

## Project Structure

```
ffdb/
├── backend/
│   ├── src/
│   │   ├── config/          # Database configuration
│   │   ├── controllers/     # Route handlers (species, search, admin, etc.)
│   │   ├── db/              # SQL schema & migrations
│   │   ├── middleware/       # Auth, prerender, security middleware
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Enrichment service (Wikipedia, GBIF)
│   │   ├── utils/           # Shared utilities
│   │   └── server.js        # Express entry point
│   ├── uploads/             # User-uploaded images (gitignored)
│   ├── .env.example         # Environment variable template
│   └── package.json
├── frontend/
│   ├── public/              # Static assets (logos, icons)
│   ├── src/
│   │   ├── components/      # Reusable UI components
│   │   ├── pages/           # Route-level page components
│   │   ├── services/        # API client
│   │   ├── styles/          # CSS design system (tokens, components, pages)
│   │   ├── utils/           # Frontend utilities
│   │   ├── App.jsx          # Root component with routing
│   │   └── main.jsx         # Entry point
│   ├── index.html           # HTML template
│   ├── vite.config.js       # Vite configuration
│   └── package.json
├── .gitignore
├── LICENSE
└── README.md
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (recommended: 22 LTS)
- **PostgreSQL** 15+
- **npm** 9+

### 1. Clone the Repository

```bash
git clone https://github.com/ffdbproject/ffdb.git
cd ffdb
```

### 2. Set Up the Database

Create a PostgreSQL database and run the schema:

```bash
# Create the database
createdb ffdb

# Run the schema
psql -d ffdb -f backend/src/db/schema.sql
```

### 3. Configure Environment Variables

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your database credentials:

```env
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=ffdb

CORS_ORIGIN=http://localhost:5173
ADMIN_API_KEY=your_secret_admin_key
```

### 4. Install Dependencies

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

### 5. Start Development Servers

Open two terminals:

```bash
# Terminal 1 — Backend (API server on port 5000)
cd backend
npm run dev

# Terminal 2 — Frontend (Vite dev server on port 5173)
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Admin Access

The admin panel is available at `/admin`. Authentication uses a secure API key set in your `.env` file (`ADMIN_API_KEY`).

### Admin Features

- **Species Manager** — Add, edit, delete, and bulk-manage species
- **Data Enrichment** — Auto-fill species data from Wikipedia and GBIF
- **Team Manager** — Manage team member profiles shown on the public Team page
- **Reports** — View and manage user-submitted problem reports
- **Database Backup** — Export and import the entire database as JSON

---

## API

FFDB provides a public RESTful API. Full interactive documentation is available at [`/api-docs`](https://ffdb.bd/api-docs).

### Quick Examples

```bash
# Get all species
curl http://localhost:5000/api/species

# Filter by category
curl http://localhost:5000/api/species?category=fauna

# Filter by conservation status
curl http://localhost:5000/api/species?conservation_status=EN

# Search
curl http://localhost:5000/api/search?q=tiger

# Get a single species
curl http://localhost:5000/api/species/panthera-tigris
```

---

## Production Deployment

### Build the Frontend

```bash
cd frontend
npm run build
```

This generates a `dist/` folder. The Express backend serves these static files in production.

### Run in Production

```bash
cd backend
NODE_ENV=production node src/server.js
```

For cPanel/shared hosting deployment, see [DEPLOYMENT.md](DEPLOYMENT.md).

---

## Contributing

Contributions are welcome! Here's how you can help:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### Ways to Contribute

- **Report bugs** — Open an issue with steps to reproduce
- **Suggest features** — Open an issue with your idea
- **Improve documentation** — Fix typos, add examples, clarify instructions
- **Add species data** — Use the [Contribute page](https://ffdb.bd/contribute) or submit via PR
- **Improve UI/UX** — Design improvements are always welcome
- **Translations** — Help translate the interface

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Species data sourced from [Wikipedia](https://www.wikipedia.org/), [GBIF](https://www.gbif.org/), [IUCN Red List](https://www.iucnredlist.org/), [EOL](https://eol.org/), and [iNaturalist](https://www.inaturalist.org/)
- Conservation status colors follow the [IUCN Red List](https://www.iucnredlist.org/) official palette
- Map tiles by [OpenStreetMap](https://www.openstreetmap.org/)

---

Made by the [FFDB Team](https://ffdb.bd/team)

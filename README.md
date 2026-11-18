<div align="center">

# Flora and Fauna Database of Bangladesh (FFDB)

**A comprehensive, open-source biodiversity database for Bangladesh.**

[![License: AGPL-3.0](https://img.shields.io/badge/License-AGPL--3.0-blue.svg)](LICENSE)
[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)

[Live Site](https://ffdb.bd) · [API Docs](https://ffdb.bd/api-docs) · [Public Data Dump](https://ffdb.bd/api/public/data-dump?format=json) · [Contribute Data](https://ffdb.bd/contribute) · [Report Bug](https://github.com/ffdbproject/ffdb/issues)

</div>

---

## Overview

The **Flora and Fauna Database of Bangladesh (FFDB)** is an authoritative, community-driven biodiversity catalog documenting the wildlife, plants, trees, and fungi across Bangladesh. Designed for researchers, educators, students, and conservationists, FFDB provides an intuitive search interface, structured taxonomic classifications, interactive location maps, rich media, and a public REST API.

---

## Key Features

- **Comprehensive Catalog** — Browse, search, and filter species of flora and fauna found in Bangladesh.
- **Bilingual Support** — Primary English, Bengali (বাংলা), and binomial scientific names for all species.
- **IUCN Conservation Status** — Global and Bangladesh national IUCN threat categories (EX, EW, RE, CR, EN, VU, NT, LC, DD, NE) with color-coded badges.
- **Taxonomic Classification** — Complete scientific taxonomy hierarchy (Kingdom → Phylum → Class → Order → Family → Genus) with taxonomic authority details.
- **Interactive Geospatial Maps** — Leaflet-powered coordinates and habitat mapping for each species.
- **Rich Media & Galleries** — Multiple images per species with attribution, image credits, zoomable lightbox, and touch swipe gestures.
- **Multi-Source Cross References** — Direct integrations and links to Wikipedia, IUCN Red List, GBIF, Plants of the World Online (POWO), BOLD Systems, World Flora Online (WFO), EOL, and iNaturalist.
- **Automated Data Enrichment** — Fast one-click data enrichment pulling descriptions, taxonomy, and images from Wikipedia and GBIF APIs.
- **Public REST API & Open Data Dumps** — Clean JSON endpoints with interactive documentation (`/api-docs`) and bulk data dumps (`/api/public/data-dump?format=json|csv`) for scientific research.
- **Community Contributions** — Public submission workflow with anti-spam rate limiting; submissions are queued for admin review before publishing.
- **Role-Based Admin & Contributor Portal** — Secure JWT authentication with token rotation, slide-out drawer quick editing, draft/pending previews, and bulk actions.
- **Database Import & Export** — Full database backup and restoration via JSON, CSV, and XLSX formats.
- **SEO & Social Sharing** — Bot prerendering middleware, dynamic JSON-LD structured data (`Taxon`, `Article`, `BreadcrumbList`), Open Graph, Twitter Cards, dynamic XML sitemaps, and robots.txt.
- **Modern Responsive Design** — Dark/light theme support, accessible design tokens, custom SVG icons, and responsive mobile navigation.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 19, React Router 7, Vite 5 |
| **Styling** | Modern CSS with Design Tokens & Variables (Light/Dark mode) |
| **Mapping** | Leaflet + React-Leaflet |
| **Backend** | Node.js, Express 5 |
| **Database** | PostgreSQL 15+ (`pg` connection pool) |
| **Caching (Optional)** | Redis |
| **Image Processing** | Sharp (auto-resize and optimization) |
| **Security** | Helmet (CSP/HSTS), HPP, CORS, Rate Limiting, sanitize-html, timing-safe authentication |
| **SEO & Metadata** | react-helmet-async, Prerender Middleware, Schema.org JSON-LD |

---

## Project Structure

```
ffdb/
├── backend/
│   ├── scripts/             # Migration & maintenance scripts
│   ├── src/
│   │   ├── config/          # PostgreSQL database connection pool
│   │   ├── controllers/     # Route logic (species, admin, search, reports, team, notices, data dump)
│   │   ├── db/              # SQL schemas and incremental migration scripts
│   │   ├── middleware/      # Auth (RBAC), rate limiters, input sanitizers, error handlers, prerender
│   │   ├── routes/          # Express route definitions
│   │   ├── services/        # Email notifications (SMTP) and data enrichment (Wikipedia/GBIF)
│   │   ├── utils/           # Auth helpers, string normalization, Redis client
│   │   └── server.js        # Server entry point
│   ├── uploads/             # User-uploaded images (gitignored, kept via .gitkeep)
│   ├── .env.example         # Template for development environment
│   ├── .env.production.example # Template for production deployment
│   ├── package.json
│   └── package-lock.json
├── frontend/
│   ├── public/              # Static icons, logos, manifests, and fallbacks
│   ├── src/
│   │   ├── assets/          # Static component assets
│   │   ├── components/      # Reusable UI components (Navbar, Footer, SpeciesCard, ThemeToggle, etc.)
│   │   ├── pages/           # Route views (Home, Browse, Detail, Admin, Team, Reports, Docs)
│   │   ├── services/        # Frontend API client
│   │   ├── styles/          # Design tokens, components, and page stylesheets
│   │   ├── utils/           # Frontend utilities and route preloading
│   │   ├── App.jsx          # Root component with routing
│   │   ├── index.css        # Global styles
│   │   └── main.jsx         # React DOM mounting
│   ├── index.html           # HTML5 shell
│   ├── vite.config.js       # Vite build configuration
│   ├── package.json
│   └── package-lock.json
├── CONTRIBUTING.md          # Contribution guidelines
├── DEPLOYMENT.md            # Production & cPanel deployment instructions
├── LICENSE                  # GNU Affero General Public License v3.0
└── README.md                # Project documentation
```

---

## Getting Started

### Prerequisites

- **Node.js** 20+ (recommended: 22 LTS)
- **PostgreSQL** 15+
- **npm** 9+

### 1. Clone the Repository

```bash
git clone https://github.com/ffdbproject/ffdb.git
cd ffdb
```

### 2. Set Up the Database

Create a PostgreSQL database and run the base schema:

```bash
# Create PostgreSQL database
createdb ffdb

# Import schema
psql -d ffdb -f backend/src/db/schema.sql
```

*(Optional)* If you have an existing database, run any required migration files located in `backend/src/db/`.

### 3. Configure Environment Variables

Copy the template `.env.example` in `backend/`:

```bash
cp backend/.env.example backend/.env
```

Edit `backend/.env` with your settings:

```env
PORT=5000
NODE_ENV=development

# Database configuration
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=ffdb

# CORS & Site URLs
CORS_ORIGIN=http://localhost:5173
PUBLIC_SITE_URL=http://localhost:5173

# Authentication
JWT_SECRET=your_jwt_secret_min_32_characters_here
ADMIN_API_KEY=your_secret_admin_api_key_here
CONTRIBUTOR_API_KEYS=contributor1:secretkey123

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500

# Email (SMTP) - Optional in development
SMTP_HOST=mail.yourdomain.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your_email_password
ADMIN_EMAIL=admin@yourdomain.com
```

### 4. Install Dependencies

```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 5. Run the Application

In terminal 1 (Backend):
```bash
cd backend
npm run dev
```

In terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Authentication & Roles

FFDB includes built-in role-based access control (RBAC):

1. **Admin (`ADMIN_API_KEY`)**:
   - Full management: create, publish, edit, delete any species.
   - Database import and export (JSON / CSV / XLSX).
   - Team member management.
   - User report handling and status updates.
   - System announcement / site notice management.
   - Access to unreleased draft previews.

2. **Contributor (`CONTRIBUTOR_API_KEYS`)**:
   - Configured as label-key pairs: `label:key,label2:key2`.
   - Submit new species records as drafts or submit for review.
   - Manage and edit their own contributions.
   - Access to private draft previews via `/species/preview/:id`.
   - Cannot publish directly or modify system-wide settings.

---

## REST API Overview

Interactive documentation is available at `/api-docs`.

### Selected Endpoints

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/species` | Public | List published species (filters: category, status, origin, pagination) |
| `GET` | `/api/species/:id` | Public | Get single species by `public_id` or internal ID |
| `POST` | `/api/species/contribute` | Public | Community submission (rate limited, saved as draft) |
| `GET` | `/api/search?q=tiger` | Public | Omni-search across scientific, English, and Bengali names |
| `GET` | `/api/public/data-dump` | Public | Bulk export of published dataset (`format=json` or `format=csv`) |
| `GET` | `/api/team` | Public | List active team members |
| `POST` | `/api/reports` | Public | Submit a problem or feedback report |
| `POST` | `/api/admin/login` | Public | Login with admin or contributor API key |
| `GET` | `/api/admin/me` | Protected | Current session profile & permissions |
| `GET` | `/api/admin/database/export` | Admin | Full database export (`format=json\|csv\|xlsx`) |
| `POST` | `/api/admin/database/import` | Admin | Bulk database import |
| `POST` | `/api/admin/enrich/:id` | Protected | Auto-enrich species with Wikipedia and GBIF data |

---

## Production Deployment

Refer to [DEPLOYMENT.md](DEPLOYMENT.md) for step-by-step instructions for deploying to VPS, Docker, or cPanel/Passenger shared hosting environments.

To create a production frontend bundle:
```bash
cd frontend
npm run build
```

---

## Contributing

We welcome contributions of all kinds! Please review [CONTRIBUTING.md](CONTRIBUTING.md) for details on submitting bug reports, feature requests, species data, and pull requests.

---

## License

This project is licensed under the **GNU Affero General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

---

## Acknowledgments

- Species data sourced from [Wikipedia](https://www.wikipedia.org/), [GBIF](https://www.gbif.org/), [IUCN Red List](https://www.iucnredlist.org/), [POWO](https://powo.science.kew.org/), and [iNaturalist](https://www.inaturalist.org/).
- Conservation badges adhere to the official [IUCN Red List](https://www.iucnredlist.org/) category framework.
- Maps rendered using [OpenStreetMap](https://www.openstreetmap.org/) contributors.

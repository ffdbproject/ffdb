Flora and Fauna Database of Bangladesh (FFDB) — MERN Application

Description
-----------
This repository contains the MERN (Mongo/Express/React/Node) style web application powering the Flora and Fauna Database of Bangladesh (FFDB). It provides a public frontend for browsing species, and an Express backend API that stores species, taxonomy, images, and admin functions.

Note: The current project uses PostgreSQL on the backend; the term "MERN" here refers to the overall web app architecture (React + Node/Express backend). Update data store instructions as needed in `backend/src/db`.

Repository layout
-----------------
- `backend/` — Express API server source and configuration
  - `src/` — server code, controllers, routes, middleware
  - `package.json` — backend dependencies and scripts
- `frontend/` — React application (Vite)
  - `src/` — React source files
  - `package.json` — frontend dependencies and scripts
- `scripts/prepare_open_source.js` — helper to prepare a publishable `open-source/` package
- `DEPLOYMENT.md` — deployment notes (cPanel), database setup and common fixes
- `open-source/` — prepared package output (generated; do not commit secrets)

Prerequisites
-------------
- Node.js 18+ and npm
- PostgreSQL (or the DB configured in `backend/.env`)
- Optional: cPanel deployment environment (see `DEPLOYMENT.md`)

Local development (backend + frontend)
------------------------------------
1. Install dependencies for backend and frontend:

```bash
cd backend
npm install

cd ../frontend
npm install
```

2. Create a `backend/.env` file with the required environment variables (see the `.env` example below).

3. Run the backend and frontend in development mode (two terminals):

Backend:
```bash
cd backend
npm run dev
```

Frontend:
```bash
cd frontend
npm run dev
```

4. Open the frontend in the browser (Vite dev server default: `http://localhost:5173`).

Environment variables (example for `backend/.env`)
-----------------------------------------------
Copy these values into `backend/.env` and provide production values before deploy.

```
PORT=5000
NODE_ENV=development

DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_NAME=your_db_name

CORS_ORIGIN=http://localhost:5173
PUBLIC_SITE_URL=http://localhost:5173
ADMIN_API_KEY=replace_with_strong_key
JWT_SECRET=replace_with_jwt_secret
```

Building for production
-----------------------
1. Build frontend:

```bash
cd frontend
npm run build
```

2. The backend server in production serves the built frontend from `frontend/dist`. Follow `DEPLOYMENT.md` for packaging and cPanel deployment steps.

Contact
-------
For questions about this repository, contact the project maintainers or add an issue in the source repository.

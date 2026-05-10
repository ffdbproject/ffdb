# FFDB cPanel Deployment Tutorial

This tutorial explains how to deploy FFDB on cPanel using:

- cPanel `Setup Node.js App`
- cPanel PostgreSQL
- one Node.js app that serves both the API and the React frontend

In production, [backend/src/server.js](backend/src/server.js) serves the API and the built frontend from [frontend/dist](frontend/dist). For cPanel `Setup Node.js App`, the safest setup is to point the application root at the `backend` folder and use `src/server.js` as the startup file.

## What You Need

- cPanel with Node.js App support
- PostgreSQL database and user in cPanel
- Your local project files
- A domain or subdomain pointing to cPanel

## 1) Build The Frontend Locally

Before uploading anything, build the React app on your computer.

```bash
cd frontend
npm install
npm run build
```

This creates `frontend/dist/`, which is what the server will use in production.

## 2) Create The PostgreSQL Database

In cPanel, open PostgreSQL and create:

1. A database
2. A database user
3. A strong password
4. Full privileges for that user on the database

Then import the schema from [backend/src/db/schema.sql](backend/src/db/schema.sql).

If your cPanel has phpPgAdmin, you can paste the SQL there. If you have SSH, you can run the schema file from the terminal.

### Fix Database Permissions

After importing the schema, you **must grant permissions** to your database user on all tables. In cPanel phpPgAdmin:

1. Click on your database
2. Open the SQL tab
3. Paste and run the contents of [backend/src/db/fix_permissions.sql](backend/src/db/fix_permissions.sql)

This grants your user `SELECT`, `INSERT`, `UPDATE`, and `DELETE` permissions on all tables (species, taxonomy, images, team_members).

If your cPanel SQL editor complains about `SELECT COUNT(*) AS total FROM (...)`, it is wrapping the pasted text as a query preview. In that case, paste and run these statements one at a time instead:

```sql
GRANT USAGE ON SCHEMA public TO "creativ5_ffdb_userr";
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO "creativ5_ffdb_userr";
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO "creativ5_ffdb_userr";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO "creativ5_ffdb_userr";
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO "creativ5_ffdb_userr";
```

**If you skip this step**, create/update/delete operations can fail with "permission denied" errors.

### Apply Database Migrations (Existing Database Only)

If your database already has data and is missing the `origin` field (added in recent updates), run the migration:

1. In cPanel phpPgAdmin, open the SQL tab
2. Paste and run the contents of [backend/src/db/migration_add_origin.sql](backend/src/db/migration_add_origin.sql)

This safely adds the `origin` column (Native/Exotic) to existing species records.

## 3) Upload The Files To cPanel

Upload the files that production needs:

- [backend/src](backend/src)
- [backend/package.json](backend/package.json)
- [backend/package-lock.json](backend/package-lock.json) if present
- [frontend/dist](frontend/dist)
- [.htaccess](.htaccess) if your hosting setup uses it

If you are using cPanel Node.js App directly, upload the `backend/` folder as a folder and keep its internal structure intact. The app root on cPanel should be the path that contains `package.json` inside `backend/`.

Do not upload these from your local machine:

- `frontend/node_modules`
- `backend/node_modules`
- `frontend/src`
- `theme/` unless you intentionally want that bundle on the server

If you want a cleaner upload package, run [prepare_deploy.js](prepare_deploy.js) locally:

```bash
node prepare_deploy.js
```

That script builds the frontend and creates `FFDB_cPanel_Ready/` for upload.

## 4) Create The Production `.env`

Create `backend/.env` on the server with your live values:

```env
PORT=5000
NODE_ENV=production

DB_HOST=localhost
DB_PORT=5432
DB_USER=creativ5_ffdb_userr
DB_PASSWORD=@8xiUA.[m2r=olsW
DB_NAME=creativ5_ffdb

CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com

PUBLIC_SITE_URL=https://yourdomain.com

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=200

ADMIN_API_KEY=your_admin_key_here
```

Important:

- `ADMIN_API_KEY` is required for admin login
- `NODE_ENV=production` must be set
- `CORS_ORIGIN` should match your real domain
- `PUBLIC_SITE_URL` should be the exact public HTTPS URL of the site and is used for canonical, Open Graph, and sitemap URLs

## 5) Set Up The Node.js App In cPanel

Open cPanel → `Setup Node.js App` → `Create Application`.

Use these values:

| Field | Value |
|---|---|
| Node.js version | Any supported version available in cPanel, ideally 18+ |
| Application mode | Production |
| Application root | The `backend` folder on cPanel |
| Application URL | Your domain or subdomain |
| Application startup file | `src/server.js` |

The startup file must resolve to [backend/src/server.js](backend/src/server.js). If cPanel is trying to run `/home/.../ffdb/src/server.js`, the application root is wrong and must be changed to the `backend` folder.

## 6) Install Backend Dependencies

Install backend dependencies inside the `backend` folder on the server.

If you have SSH:

```bash
cd /path/to/your/app/backend
npm install --production
```

If cPanel shows an NPM install option inside the Node.js app screen, you can use that too.

## 7) Create The Uploads Directory

The app stores uploaded species images in `backend/uploads`.

```bash
cd /path/to/your/app/backend
mkdir -p uploads
chmod 755 uploads
```

## 8) Restart The App

After uploading files or changing `.env`, restart the Node.js app from cPanel.

If you use SSH and Passenger restart files, you can also do this:

```bash
mkdir -p /path/to/your/app/tmp
touch /path/to/your/app/tmp/restart.txt
```

## 9) Test The Live Site

Check these URLs after deployment:

| URL | Expected result |
|---|---|
| `https://yourdomain.com/` | Frontend homepage loads |
| `https://yourdomain.com/api/health` | API health JSON |
| `https://yourdomain.com/species` | React browse page |
| `https://yourdomain.com/admin` | Admin dashboard |
| `https://yourdomain.com/api-docs` | API documentation page |
| `https://yourdomain.com/api/openapi.json` | Machine-readable API spec |

## How To Update An Existing Deployment

When you make changes later, only update what changed.

### Frontend-only changes

1. Run `npm run build` inside `frontend/`
2. Upload the new `frontend/dist/` folder
3. Restart the Node.js app

### Backend-only changes

1. Upload the changed files inside `backend/src/`
2. If dependencies changed, run `npm install --production` in `backend/`
3. Restart the Node.js app

### Database changes

1. Update the schema or create a migration SQL file
2. Run the SQL on the PostgreSQL database
3. Restart the app if needed

## Common Problems And Fixes

### 500 error or "An internal server error occurred"

Check these first:

- `backend/.env` exists
- DB host, user, password, and name are correct
- `ADMIN_API_KEY` is set
- `frontend/dist` exists on the server
- the schema was imported successfully
- you restarted the app after uploading changes

### cPanel says the app responds with HTML or "check availability of application has failed"

This usually means cPanel is pointing the Node app at the wrong folder.

Check:

- Application root is the `backend` folder, not the project root
- Application startup file is `src/server.js`
- `npm install --production` was run inside `backend`
- there is no extra `package.json` at the wrong level that points to `src/server.js` from the wrong directory

If cPanel is trying to run `/home/creativ5/test.hwbd.org/ffdb/src/server.js`, move the application root to `/home/creativ5/test.hwbd.org/ffdb/backend` and restart the app.

### Main domain shows `{"success":false,"message":"Route not found: GET /"}`

This usually means the app started, but `NODE_ENV=production` was not loaded from `backend/.env`, so the production block that serves the React frontend never ran.

Check:

- `backend/.env` exists in the backend folder
- `NODE_ENV=production` is set exactly
- the Node.js app was restarted after editing `.env`
- `frontend/dist/index.html` exists on the server
- the app root is still the `backend` folder and the startup file is `src/server.js`

If `NODE_ENV` is missing or not set to `production`, the backend will answer `/` with the JSON 404 from `notFoundHandler` instead of serving the frontend.

### cPanel says "Can't acquire lock for app: test.hwbd.org/ffdb/backend"

This means cPanel already has a Node.js app instance attached to that same root, or the app is still registered under a conflicting path.

Fix it by checking these in `Setup Node.js App`:

- Make sure there is only one app using the `backend` root
- Delete the old app entry if you already created one with the wrong root
- Recreate the app with the root set to the `backend` folder only
- Use `src/server.js` as the startup file
- Restart the app after saving

If the lock stays stuck, wait a moment, refresh the Node.js App page, and try again after confirming the old app was removed first.

### Admin login does not work

Check:

- `ADMIN_API_KEY` in `backend/.env`
- cookies are allowed in the browser
- `CORS_ORIGIN` matches the live domain

### Pages work on the homepage but 404 on refresh

Check:

- `NODE_ENV=production`
- [app.js](app.js) is the startup file in cPanel
- `frontend/dist/index.html` exists on the server

### Image uploads fail

Check:

- `backend/uploads` exists
- the folder is writable by Node.js
- the file you uploaded is an image and is under the size limit

## Simple Deployment Checklist

- [ ] Frontend built locally
- [ ] PostgreSQL database created
- [ ] Schema imported
- [ ] `backend/.env` configured
- [ ] Node.js app created in cPanel
- [ ] `backend/uploads` created
- [ ] Backend dependencies installed
- [ ] App restarted
- [ ] `/api/health` works

## Fast Update Routine

For future updates, this is the safest order:

1. Change code locally
2. Run `npm run build` in `frontend/`
3. Upload changed backend files and the new `frontend/dist/`
4. Restart the Node.js app in cPanel
5. Test `/api/health`, `/api-docs`, and the homepage

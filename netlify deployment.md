# Netlify deployment notes

## What's done
- `db.js` now uses Turso (`@libsql/client`) instead of `better-sqlite3`, since
  Netlify Functions can't reliably persist a local SQLite file.
- `server.js` exports the Express `app` instead of calling `app.listen()`
  when deployed; it still runs locally as normal with `npm run dev`.
- `netlify/functions/api.js` wraps the app with `serverless-http`.
- `netlify.toml` routes `/api/*` to that function and serves `public/`
  (now holding `index.html`, `script.js`, `style.css`) as the static site.
- `package.json` lists the required dependencies.

## What YOU still need to do

### 1. routes/books.js, routes/members.js, routes/issues.js — done
These are now converted and included in this bundle: every handler is
`async`, uses `const { db } = require('../db')`, and calls
`db.execute({ sql, args })` (returning `.rows` / `.rowsAffected` /
`.lastInsertRowid`) instead of the old synchronous `better-sqlite3`
`db.prepare().get()/.run()/.all()`. The issue/return flows use
`db.batch([...], 'write')` in place of `db.transaction()`, since libSQL's
batch is the equivalent atomic multi-statement call.

### 2. Create a Turso database
    npm install -g @tursodb/cli   # or see turso.tech for the installer
    turso auth login
    turso db create library-app
    turso db show library-app --url          # -> TURSO_DATABASE_URL
    turso db tokens create library-app        # -> TURSO_AUTH_TOKEN

### 3. Set environment variables in Netlify
Site settings -> Environment variables -> add TURSO_DATABASE_URL and
TURSO_AUTH_TOKEN. Redeploy after adding them.

### 4. Deploy
    npm install -g netlify-cli
    netlify login
    netlify init          # links this folder to a new/existing Netlify site
    netlify deploy --prod
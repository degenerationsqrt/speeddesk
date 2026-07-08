# Apex Predator Elite

Apex Predator Elite is a GitHub Pages-ready React app for speed, agility, plyometric, and soccer drill planning. It packages the Apex Predator Elite training workflow into a deployable Vite project with local data storage, installable PWA metadata, and the original standalone HTML version preserved in `public/apex-predator-elite.html`.

## Current Features

- Player roster with emails, groups, status, and notes.
- Program builder for reusable individual, group, or squad workouts.
- Calendar scheduling for players, groups, or the whole squad.
- Team Sync setup screen for taking roster and schedule data live with Supabase.
- Email draft generation for scheduled sessions with location and workout details.
- Drill library, speed logs, benchmark tests, trends, and local backup/restore.

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL Vite prints, usually:

```text
http://127.0.0.1:5173/
```

## Build

```bash
npm run build
```

## Team Sync

Team Sync is the first cloud-ready path for taking the app live outside GitHub Pages. It keeps the current local app working, then adds a Supabase-backed sync layer when credentials are present.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. Copy `.env.example` to `.env.local`.
4. Add your project values:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

5. Deploy the Vite app to Vercel or Netlify and add the same environment variables there.

This repo includes `vercel.json` and `netlify.toml` so either host can build with `npm run build` and publish `dist`.

The current schema uses a single `team_snapshots` table so the first live version can sync roster, programs, and whole-roster scheduled sessions quickly. Add Supabase Auth and stricter row-level security before storing sensitive athlete information.

Invite links use a `?team=INVITE_CODE` URL. When an athlete opens that link, the app switches into an athlete-facing schedule view and loads the shared team snapshot from Supabase.

## GitHub Pages

The repository includes a GitHub Actions workflow that builds the app and deploys `dist` to GitHub Pages after pushes to `main`.

The standalone source file is also copied into the public build and can be opened at:

```text
./apex-predator-elite.html
```

## Install On A Phone

After deploying the built app to an HTTPS host, open it on your phone and use the browser's install action:

- Android Chrome: tap the browser menu, then install or add to home screen.
- iPhone Safari: tap Share, then Add to Home Screen.

Data is stored locally in the browser through the app's `window.storage` adapter. Use the in-app backup export before clearing browser storage or moving to another computer.

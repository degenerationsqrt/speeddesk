# Apex Predator Elite

Apex Predator Elite is a GitHub Pages-ready React app for speed, agility, plyometric, and soccer drill planning. It packages the Apex Predator Elite training workflow into a deployable Vite project with local data storage, installable PWA metadata, and the original standalone HTML version preserved in `public/apex-predator-elite.html`.

## Current Features

- Player roster with emails, groups, status, and notes.
- One-screen weekly planner with preset workouts, custom workout building, and rest days.
- Per-day or full-week workout links for the full team or a selected group.
- No-login player view with local workout checkmarks, effort, and pain notes.
- Native phone sharing plus copy-link and player-preview controls.
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

## Share Workouts

The standard player-sharing flow does not use Supabase, email, accounts, approval requests, or invitation codes.

Coach flow:

1. Open **Plan** and choose a day.
2. Assign a designed preset, build a custom workout from drills, copy another day, or set a rest day.
3. Choose **All players** or a group.
4. Share the selected day, or switch to the full week, then send the link by text, email, or another phone app.

Player flow:

1. Tap the coach's workout link.
2. The assigned plan opens immediately.
3. Tap **Start Workout**, check each step, then tap **Finish Workout**.

The self-contained link contains the assigned workout steps plus the team, coach, group, and readiness labels. It does not include player names, emails, coach notes, schedules, or private roster data. A selected-day link is the compact default; a full-week link is longer because it carries all seven workouts. Player checkmarks and completion stay on that device, so the simple sharing flow continues to work without a database.

The Supabase schema and account APIs remain in the repository for future optional roster and coach-verification features, but they are not required for sharing workouts. Never put a Supabase service-role or secret key in a `VITE_` variable.

This repo includes `vercel.json` and `netlify.toml` so either host can build with `npm run build` and publish `dist`.

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

Coach planning data remains local in the browser through the app's `window.storage` adapter. Use the in-app backup export before clearing browser storage or moving to another computer.

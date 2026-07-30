# Apex Predator Elite

Apex Predator Elite is a GitHub Pages-ready React app for speed, agility, plyometric, and soccer drill planning. It packages the Apex Predator Elite training workflow into a deployable Vite project with local data storage, installable PWA metadata, and the original standalone HTML version preserved in `public/apex-predator-elite.html`.

## Current Features

- Player roster with emails, groups, status, and notes.
- Program builder for reusable individual, group, or squad workouts.
- Calendar scheduling for players, groups, or the whole squad.
- Secure coach and player accounts with team/group invite codes and coach approval.
- Cloud-synced player workout logs with checked steps, duration, effort, pain, and coach review.
- Team Sync dashboard for group switching, invitation management, and workout verification.
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

Team Sync keeps the coach planner local-first while securely syncing approved player accounts, assignments, and workout evidence through Supabase.

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the Supabase SQL editor.
3. In Supabase Authentication, enable email sign-in and add the local and production app URLs to the redirect allow list.
4. Copy `.env.example` to `.env.local`.
5. Add your public project values:

```text
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-public-publishable-key
```

6. Deploy the Vite app to Vercel or Netlify and add the same environment variables there.

This repo includes `vercel.json` and `netlify.toml` so either host can build with `npm run build` and publish `dist`.

The schema enables row-level security on every player table. It stores roster identity separately from coach-only notes, hashes invite codes, removes the raw code after redemption, and requires an authenticated team relationship before data can be read. Never put a Supabase service-role or secret key in a `VITE_` variable.

Coach flow:

1. Open Team Sync and request a secure email sign-in link.
2. Sync the team and daily plan.
3. Create a team or group player code.
4. Approve each join request.
5. Switch groups and review workout evidence in the Workout Proof panel.

Player flow:

1. Open the `?team=INVITE_CODE` link or enter through the shared invite.
2. Sign in with the player or parent email.
3. Enter the player name and wait for coach approval.
4. Tap Start Workout, check each step, then tap Finish Workout.

Progress saves locally first and queues if the device is offline. Once connected, it syncs to the coach dashboard. Apple Watch, Samsung Galaxy Watch, and Strava are optional future data sources; the phone/web flow does not require a watch.

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

Coach planning data remains local in the browser through the app's `window.storage` adapter, with the approved player plan synced through Team Sync. Use the in-app backup export before clearing browser storage or moving to another computer.

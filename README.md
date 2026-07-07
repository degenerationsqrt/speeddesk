# Apex Predator Elite

Apex Predator Elite is a GitHub Pages-ready React app for speed, agility, plyometric, and soccer drill planning. It packages the Apex Predator Elite training workflow into a deployable Vite project with local data storage, installable PWA metadata, and the original standalone HTML version preserved in `public/apex-predator-elite.html`.

## Current Features

- Player roster with emails, groups, status, and notes.
- Program builder for reusable individual, group, or squad workouts.
- Calendar scheduling for players, groups, or the whole squad.
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

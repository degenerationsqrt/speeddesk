# SpeedDesk

SpeedDesk is a local React app for speed, agility, plyometric, and soccer drill planning. It is modeled after IronDesk's mobile-first local journal, but uses the speed-folder workbooks, PDFs, and DOCX as its drill/program source material.

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

## Install On A Phone

After deploying the built app to an HTTPS host, open it on your phone and use the browser's install action:

- Android Chrome: tap the browser menu, then install or add to home screen.
- iPhone Safari: tap Share, then Add to Home Screen.

Data is stored in the browser with `localStorage` through the app's `window.storage` adapter. Use the in-app backup export before clearing browser storage or moving to another computer.

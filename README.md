# ZeeShare

Unlimited local-network file sharing in the browser. Files move device-to-device
over WebRTC — nothing is uploaded or stored on a server. Live at
https://share.zeelinks.com.pk

This repository is a **plain Vite + React single-page app**. It has no
Lovable, no SSR server, no Supabase and no Cloudflare dependency. `npm run build`
produces static files in `dist/client` that Firebase Hosting serves directly.

## Run locally

```bash
npm install
cp .env.example .env      # fill in the VITE_FIREBASE_* values
npm run dev               # http://localhost:8080
```

`index.html` at the repo root is the entry point, so the project also opens with
any Vite-compatible tooling. To preview the exact production output:

```bash
npm run build
npm run preview
```

To test sharing between two devices, open the dev/preview URL on your phone using
your PC's LAN address (e.g. `http://192.168.1.5:8080`) while both are on the same
Wi-Fi. Without the Firebase values the page loads but shows "Network unavailable",
because devices cannot find each other.

## Deploy

- Manual: `npm run build && firebase deploy --only hosting`
- Automatic: push to `main` — `.github/workflows/firebase-hosting.yml` builds and
  deploys. Add these GitHub repository secrets first:
  `FIREBASE_SERVICE_ACCOUNT`, `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
  `VITE_FIREBASE_DATABASE_URL`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`.

Full details, database rules and domain/DNS notes are in [DEPLOY.md](./DEPLOY.md).

## Structure

```
index.html                 app entry (root)
src/main.tsx               React bootstrap
src/router.tsx             TanStack Router setup (client-side only)
src/routes/                one file per page: /, how-it-works, faq, about,
                           contact, privacy, terms, cookies
src/components/zeeshare/   sharing UI
src/lib/zeeshare/          WebRTC engine, network room, Firebase signaling
src/styles.css             design system (Tailwind v4 tokens)
firebase.json              hosting config + SPA rewrite
database.rules.json        Realtime Database rules for the pairing relay
```

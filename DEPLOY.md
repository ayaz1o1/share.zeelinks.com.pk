# Deploying ZeeShare to share.zeelinks.com.pk

ZeeShare is a fully client-side app. File bytes travel directly between browsers
on the same network, so hosting only needs to serve static files plus a tiny
Firebase Realtime Database used for pairing messages.

## 1. Create the Firebase project

1. Create a Firebase project and enable **Realtime Database** (Spark / free plan
   is enough — pairing messages are a few hundred bytes each).
2. Deploy the database rules in this repo:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add          # select your project
   firebase deploy --only database
   ```
3. Copy the web app config values from Project settings into `.env`
   (see `.env.example`).

## 2. Build

```bash
npm install
npm run build
```

The static site is emitted to `dist/client`, which is what `firebase.json`
points at. The SPA rewrite makes `/faq`, `/privacy` and friends resolve on
refresh.

## 3. Deploy hosting

Manual:

```bash
firebase deploy --only hosting
```

From GitHub (recommended): push to `main`. The workflow in
`.github/workflows/firebase-hosting.yml` runs the build and deploys to the
`zee-linkss` project. Add the repository secrets listed in README.md first —
`VITE_*` values must exist at build time or the deployed site cannot pair devices.

## 4. Connect the domain

In Firebase Hosting → Add custom domain, enter `share.zeelinks.com.pk` and add
the TXT/A records Firebase shows you at your DNS provider for
`zeelinks.com.pk`. HTTPS is provisioned automatically.

## 5. After going live

- Submit `https://share.zeelinks.com.pk/sitemap.xml` in Google Search Console.
- Apply for AdSense once the site is reachable on the domain. The Privacy,
  Terms, Cookies, About and Contact pages required for review are already
  included, and the cookie/ads disclosure contains the wording Google expects.
- Add your AdSense snippet to `src/routes/__root.tsx` (in the `scripts` array of
  `head()`), then place ad units on the content pages — not on the sharing page,
  so the tool itself stays clean.

## Notes on limits

- No file size limit: files are streamed in 256 KB chunks, so only one chunk is
  in memory at a time on each device.
- No storage cost: nothing is ever uploaded, so there is no bandwidth or storage
  billing regardless of how much people transfer.
- Transfers are network-local by design: no STUN or TURN servers are configured,
  so only local addresses can be used to connect. Devices on different networks
  simply never see each other.

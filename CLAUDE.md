# Lampa — notes for Claude

Lampa is a book reader (FB2, EPUB, TXT) for Windows, macOS and Linux (Electron) and iPhone/iPad (Capacitor), with reading lists, ratings, translation of selected text and cloud sync. The owner is Vladimir (GitHub `Zelinsky-Vladimir`). **Talk to him in Russian.** Code comments are in Russian; README, commit messages and this file are in English.

## Repositories

- `Zelinsky-Vladimir/lampa` — **private**, all source code (this repo).
- `Zelinsky-Vladimir/lampa-releases` — **public**, no code: the download page, installers and auto-update files. Its README is generated from ours with `node scripts/public-readme.js <clone of lampa-releases>` (drops build-from-source parts and swaps links).

## Rules

- Commit as `Vladimir <34725004+Zelinsky-Vladimir@users.noreply.github.com>`. Never put his work email in commits or anything public.
- End commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Don't publish copyrighted book text (screenshots use public-domain samples).
- Never sign in with passwords or create accounts on real services yourself; he approves logins himself (GitHub and the Supabase CLI were authorised through browser device flows).
- New UI strings go into all five languages in `src/i18n.js` (en, ru, fr, de, es).
- Desktop CSP is strict (`src/index.html`): renderer network goes only to the Supabase project; everything else is fetched by the main process (desktop) or native HTTP (iOS).

## Layout

```
main.js            Electron main: window, files, book copies (Books/<sha256-16>/<file>), covers, updates, lampa:// links, IPC
preload.js         window.api for the desktop renderer
src/app.js         the whole reader UI (library, reading, pages/curl, notes, translation, reading lists, sync)
src/parsers.js     FB2 / EPUB / TXT → safe DOM (allow-list, never innerHTML)
src/decode.js      text encoding detection
src/i18n.js        interface strings, 5 languages
src/online.js      book search (Apple Books + Open Library), genres, reader ratings (+ Wikidata for originals), translation; shared by desktop and iOS
src/stamps.js      change stamps per record for sync (fingerprint, time, tombstones, pushed flag)
src/cloud.js       Supabase over plain HTTP: auth (password, Google PKCE), records pull/push, book files in storage
mobile/mobile.js   iOS platform layer: the same window.api on Capacitor (Filesystem, native HTTP, App, StatusBar)
mobile/mobile.css  phone styles (safe areas, touch)
ios/               Xcode project (Capacitor 8, Swift Package Manager, no CocoaPods)
ios/App/App/WebAuth.swift  local plugin `WebAuth.start({url, scheme})` (ASWebAuthenticationSession) + LampaBridgeViewController that registers the local plugins
ios/App/App/AppleSignIn.swift  local plugin `AppleSignIn.authorize({nonce})` → `{idToken}` (sends SHA-256 of the nonce to Apple); App.entitlements enables Sign in with Apple
scripts/build-mobile.js  assembles www/ for Capacitor (src + mobile + fflate + icon), syncs iOS version from package.json
supabase/schema.sql      database schema (records table + RLS + newer-wins trigger, private `books` bucket)
```

## Desktop

- `npm start` runs from source. Releases: bump `version` in package.json, commit, `git tag vX.Y.Z`, push the tag. GitHub Actions builds Windows/macOS/Linux and publishes to this repo and to `lampa-releases` (needs the `RELEASES_TOKEN` secret, a fine-grained token with write access to `lampa-releases` only). Installed apps auto-update from `lampa-releases`.
- macOS minutes count 10× in a private repo, so the iOS check workflow runs only on tags or by hand.
- Dev hooks (env vars): `LAMPA_USER_DATA` (separate profile), `LAMPA_SCREENSHOT=out.png` (screenshot after load, then quit), `LAMPA_EVAL` (JS to run before the screenshot), `LAMPA_SHOT_DELAY`, `LAMPA_CLOUD_URL` (point sync at a local Supabase, e.g. `supabase start` on 127.0.0.1:54321 — allowed by the desktop CSP).

## Cloud sync (Supabase)

- Project ref `lxztjateewlladvgzzlj` ("Lampa Server", Frankfurt). URL and the publishable key are in `src/cloud.js` (public by design). Never use or ask for the service-role/secret key or the database password.
- Apply schema changes with the Supabase CLI (login is stored on his machine; on a new machine run `npx supabase login` in a terminal he can type into): `npx supabase db query --linked --project-ref lxztjateewlladvgzzlj -f supabase/schema.sql`.
- Auth: Google provider (Google Cloud project "Lampa", OAuth consent in Testing mode with test users — publishing needs a privacy policy page) and email/password with "Confirm email" off. Redirect URLs allowed: `lampa://auth-callback` (desktop) and `io.github.zelinskyvladimir.lampa://auth-callback` (iOS).
- Records: kind `lib` (id = `size|title|author`, library entry + reading position), `mark` (bookmark/note id), `shelf` (reading-list book id). Newer `updated_at` wins (server trigger). Records arriving from the server are stamped `r` and not pushed back. Book files go to `books/<user id>/<sha256-16>.<ext>` (≤ 50 MB).
- Sync runs on start, on window focus, a few seconds after changes and every minute. If the open book moved on another device, a banner offers to jump.

## iOS (current focus)

Built on a Mac: `npm ci`, then `npm run ios` (builds www, `cap sync ios`, opens Xcode); pick his Team in Signing & Capabilities and Run on the iPhone. Bundle id `io.github.zelinskyvladimir.lampa`. He is enrolling in the paid Apple Developer Program.

Done: reader on the phone (pages + slide by default, swipes, tap zones, selection bar under the iOS menu, long-press reordering in Want to read, safe areas), books imported via the Files picker and "Open in Lampa" (document types for fb2/epub/txt/zip), covers/lists stored in the app folder, localStorage mirrored to a file, email/password sync, Google sign-in (`api.openAuth` → `WebAuth` plugin, callback `io.github.zelinskyvladimir.lampa://auth-callback` returned straight to the app, no URL scheme registration; verified end to end in the simulator). CI builds it for the simulator and checks the log line `[lampa] ready: plugins=…`.

Not done yet, roughly in order:
1. First run on his real iPhone and fix what comes up (gestures, selection, "Open in Lampa", sync).
2. Sign in with Apple — code is done (`api.signInApple` → `Cloud.idTokenSignIn('apple', idToken, rawNonce)`, button shown only on iOS, closing the sheet counts as cancel). Still to do: Supabase → Apple provider enabled with Client IDs `io.github.zelinskyvladimir.lampa` (no secret needed for native-only), a build with his paid team, a real-device test.
   Until the paid team is active, device builds with the Personal Team need `CODE_SIGN_ENTITLEMENTS=` on the xcodebuild command line (personal teams can't sign the Sign in with Apple capability).
   Account deletion (guideline 5.1.1(v)) is in Settings → Sync → Delete account (two taps): `Cloud.deleteAccount` removes the user's files in `books/` through the Storage API, then calls the `public.delete_account()` RPC (security definer, granted to `authenticated` only), which deletes the auth user; records go with it by cascade. With Sign in with Apple, Apple also expects the user's Apple tokens to be revoked on deletion — not done yet (needs a server-side call with the Apple key).
3. Privacy policy and support pages are live on GitHub Pages (`lampa-releases/docs`, English + Russian, contact sunstrike1997@gmail.com): https://zelinsky-vladimir.github.io/lampa-releases/privacy.html and .../support.html. Next: use them in Google Auth Platform → Branding and publish the Google OAuth app; prepare App Store Connect (record, screenshots, privacy labels). Keep the privacy page in sync with what the app sends where.
4. TestFlight: archive in Xcode and upload, or automate later.
5. For a paid/public release the free Google Translate endpoint should move to an official service behind a server proxy (Microsoft Translator keeps the dictionary).

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
- Page mode uses CSS columns; WebKit (iOS) needs an explicit `column-width` (`--page-col-w`) or `column-count: 1` makes no columns at all.
- Desktop CSP is strict (`src/index.html`): renderer network goes only to the Supabase project and to presigned R2 URLs (`https://*.r2.cloudflarestorage.com`); everything else is fetched by the main process (desktop) or native HTTP (iOS). `scripts/build-mobile.js` swaps that exact connect-src string, so change both together.

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
src/cloud.js       Supabase over plain HTTP: auth (password, Google PKCE, Apple id_token), records pull/push, book files through the `books` function + presigned R2 URLs
mobile/mobile.js   iOS platform layer: the same window.api on Capacitor (Filesystem, native HTTP, App, StatusBar)
mobile/mobile.css  phone styles (safe areas, touch)
ios/               Xcode project (Capacitor 8, Swift Package Manager, no CocoaPods)
ios/App/App/WebAuth.swift  local plugin `WebAuth.start({url, scheme})` (ASWebAuthenticationSession) + LampaBridgeViewController that registers the local plugins
ios/App/App/AppleSignIn.swift  local plugin `AppleSignIn.authorize({nonce})` → `{idToken}` (sends SHA-256 of the nonce to Apple); App.entitlements enables Sign in with Apple
scripts/build-mobile.js  assembles www/ for Capacitor (src + mobile + fflate + icon), syncs iOS version from package.json
supabase/schema.sql      database schema (records + RLS + newer-wins trigger, book_files quota ledger, delete_account(); the old `books` storage bucket is unused)
supabase/functions/books Edge Function for book files in Cloudflare R2: list / upload (quota check + presigned PUT) / confirm (HEAD, real size) / download (presigned GET) / delete / deleteAll
```

## Desktop

- `npm start` runs from source. Releases: bump `version` in package.json, commit, `git tag vX.Y.Z`, push the tag. GitHub Actions builds Windows/macOS/Linux and publishes to this repo and to `lampa-releases` (needs the `RELEASES_TOKEN` secret, a fine-grained token with write access to `lampa-releases` only). Installed apps auto-update from `lampa-releases`.
- macOS minutes count 10× in a private repo, so the iOS check workflow runs only on tags or by hand.
- Dev hooks (env vars): `LAMPA_USER_DATA` (separate profile), `LAMPA_SCREENSHOT=out.png` (screenshot after load, then quit), `LAMPA_EVAL` (JS to run before the screenshot), `LAMPA_SHOT_DELAY`, `LAMPA_CLOUD_URL` (point sync at a local Supabase, e.g. `supabase start` on 127.0.0.1:54321 — allowed by the desktop CSP).

## Layout (redesign 0.13, design canvas https://claude.ai/artifact/PwZvFqxpLde6kkPy9RXEEb)

- Home: brand + account button (initial and sync-status dot) in the bar; `#home-top` = "Continue reading" card (`#cont-card`) and, ≥900px, "Up next" (`#up-next`); `#home-add` "Add a book" block under it; "Recent" shows at most 6 books, `#recent-all` ("All N", only when there are more) opens `#all-view` (search + chips: recent / reading / not started / title). `#home-empty` hero only when the library is empty.
- Read tab: `.card`s in a grid, rows on phones (CSS only); stats = count · this year · average. Want tab: `#shelf-grid.list` of `.want-row`s (grip ≡, number, cover, title, readers' rating, "Read it", × with confirm on hover devices); drag by the grip (touch: grip drags at once, elsewhere long press), drop position by Y. Sort: chips on wide screens, `#sort-btn` (a transparent `<select>` over an icon) on phones.
- Reader bar: back, TOC, title + chapter, search, bookmark, autoscroll (`.no-phone`), fullscreen, font-size stepper `#bar-size` (>960px), eye icon `#btn-settings` (Appearance). No "more" menu and no mark-read button: the book-end card `#end-card` (stars 1–10, "Add to Read" / "Not now", shown once per book via `entry.endAsked`) does that.
- Footer: `#foot-size` stepper (≤960px), chapter, `#scrub` (custom thumb, `--fill`), `#page-btn` "127 / 388" opening `#goto-pop` (page number or `55%`; a bottom sheet on phones, `--kb` follows the keyboard). On phones the footer is two rows (slider, then size · chapter · % · page). Jumps push onto `backStack`; `#back-btn` says "Back to page N" and `#scrub-ghost` marks the old place. Footer hides while reading by default (`footerAlways: false`, migrated once via `layoutV`); `progressLine` hides the thin line.
- `#settings-panel` = Appearance: brightness, themes, five font chips (`TOP_FONTS`), size and line-spacing steppers, mode (pages / scroll only, no two-page spread); under `.ap-more`: all fonts, colours, width, alignment, paragraphs, animation, footer, progress line, autoscroll speed (not on phones). `#account-panel` = sync (no "Sync now" button: status line only, tap retries on error/offline), language, translate-to, about, shortcuts.
- iOS: `LampaWebView.hideEditMenu` removes the system edit menu while a book is open (our `#sel-bar` replaces it); JS toggles it via the `ReaderMenu` plugin (`api.setEditMenu`), and turns it back on while an input has focus. Safe-area insets are applied on all sides, so landscape works on iPhone and iPad.

## Cloud sync (Supabase)

- Project ref `lxztjateewlladvgzzlj` ("Lampa Server", Frankfurt). URL and the publishable key are in `src/cloud.js` (public by design). Never use or ask for the service-role/secret key or the database password.
- Apply schema changes with the Supabase CLI (login is stored on his machine; on a new machine run `npx supabase login` in a terminal he can type into): `npx supabase db query --linked --project-ref lxztjateewlladvgzzlj -f supabase/schema.sql`.
- Auth: Google provider (Google Cloud project "Lampa", OAuth app published) and email/password with "Confirm email" off. Redirect URLs allowed: `lampa://auth-callback` (desktop) and `io.github.zelinskyvladimir.lampa://auth-callback` (iOS).
- Records: kind `lib` (id = `size|title|author`, library entry + reading position), `mark` (bookmark/note id), `shelf` (reading-list book id). Newer `updated_at` wins (server trigger). Records arriving from the server are stamped `r` and not pushed back. Book files live in Cloudflare R2 bucket `lampa-books` at `<user id>/<sha256-16>.<ext>` (≤ 50 MB each). Only the `books` Edge Function holds the R2 keys (Supabase function secrets `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, set by him); clients get 15-minute presigned URLs. `public.book_files` is the per-user ledger (RLS: read own only, writes only from the function); a file counts once `confirm` has checked its real size in R2. Quota per account: `BOOK_QUOTA_MB` function secret, default 300; over quota the function answers 413 `QUOTA` and the app shows `syncQuotaFull` once and keeps the book local; `confirm` also answers `EMPTY` (422) or `TOO_LARGE` (413), and one failing book never stops the others from uploading. The bucket is in the EU jurisdiction (`R2_JURISDICTION`, default `eu`, host `<account>.eu.r2.cloudflarestorage.com`). Object sizes come from ListObjectsV2, never from a HEAD: Cloudflare compresses text objects such as FB2 on the fly and drops Content-Length. Deploy: `npx supabase functions deploy books --project-ref lxztjateewlladvgzzlj --no-verify-jwt --use-api` (the function checks the user token itself).
- Feature flags live in the user's Supabase `app_metadata.features` (only the server can set them) and reach the app with the session (`cloud.session.user.features`). `translate` turns on translation on the desktop; without it the selection-bar button and the "Translate into" setting are hidden. Only his account (zelinskiy.v97@gmail.com) has it, set with `update auth.users set raw_app_meta_data = raw_app_meta_data || '{"features":["translate"]}' where email = …`. iOS always translates on the device.
- Sync runs on start, on window focus, a few seconds after changes and every minute. If the open book moved on another device, a banner offers to jump.

## iOS (current focus)

Built on a Mac: `npm ci`, then `npm run ios` (builds www, `cap sync ios`, opens Xcode); Run on the iPhone. Bundle id `io.github.zelinskyvladimir.lampa`, team `PV476BT87F` (his paid Individual Apple Developer account, set as DEVELOPMENT_TEAM in the project; automatic signing). Use Node 22 (`~/.nvm/versions/node/v22.21.1/bin`); the machine's nvm default may be older.

Done: reader on the phone (pages + slide by default, swipes, tap zones, selection bar under the iOS menu, long-press reordering in Want to read, safe areas), books imported via the Files picker and "Open in Lampa" (document types for fb2/epub/txt/zip), covers/lists stored in the app folder, localStorage mirrored to a file, email/password sync, Google sign-in (`api.openAuth` → `WebAuth` plugin, callback `io.github.zelinskyvladimir.lampa://auth-callback` returned straight to the app, no URL scheme registration; verified end to end in the simulator). CI builds it for the simulator and checks the log line `[lampa] ready: plugins=…`.

Not done yet, roughly in order:
1. First run on his real iPhone and fix what comes up (gestures, selection, "Open in Lampa", sync).
2. Sign in with Apple — code is done (`api.signInApple` → `Cloud.idTokenSignIn('apple', idToken, rawNonce)`, button shown only on iOS, closing the sheet counts as cancel). Still to do: Supabase → Apple provider enabled with Client IDs `io.github.zelinskyvladimir.lampa` (no secret needed for native-only), a build with his paid team, a real-device test.
   Account deletion (guideline 5.1.1(v)) is in Settings → Sync → Delete account (two taps): `Cloud.deleteAccount` removes the user's files in `books/` through the Storage API, then calls the `public.delete_account()` RPC (security definer, granted to `authenticated` only), which deletes the auth user; records go with it by cascade. With Sign in with Apple, Apple also expects the user's Apple tokens to be revoked on deletion — not done yet (needs a server-side call with the Apple key).
3. Privacy policy and support pages are live on GitHub Pages (`lampa-releases/docs`, English + Russian, contact sunstrike1997@gmail.com): https://zelinsky-vladimir.github.io/lampa-releases/privacy.html and .../support.html. Google Auth Platform branding uses them and the Google OAuth app is published (In production), so any Google account can sign in. Next: prepare App Store Connect (record, screenshots, privacy labels). Keep the privacy page in sync with what the app sends where.
4. TestFlight: App Store Connect record "Lampa: Book Reader" (the name "Lampa" is taken; the home-screen name stays Lampa), SKU `lampa-ios`, iPhone and iPad (iPad needs all four orientations in Info.plist). Upload a build:
   ```
   npm run build:mobile && npx cap sync ios
   xcodebuild -project ios/App/App.xcodeproj -scheme App -configuration Release -destination 'generic/platform=iOS' -archivePath ios/release/out/Lampa.xcarchive -allowProvisioningUpdates archive
   xcodebuild -exportArchive -archivePath ios/release/out/Lampa.xcarchive -exportOptionsPlist ios/release/ExportOptions.plist -exportPath ios/release/out/export -allowProvisioningUpdates
   ```
   The build number comes from package.json (0.10.1 → 1001), so bump the version before every upload; App Store Connect rejects a repeated build number. First build 0.10.1 (1001) uploaded on 2026-10-13; internal TestFlight works (he installed it on his iPhone).
5. Translation: on iOS it is Apple's on-device Translation framework (`ios/App/App/AppleTranslate.swift`, iOS 18+, `api.translateOnDevice`), no network and no limits; Google is not used on the phone. The desktop still uses the free Google endpoint; for a public release it should move to Microsoft Translator behind a Supabase Edge Function with per-user monthly limits (free ≈ 20 translations, premium ≈ 1000).
6. Storage and money (decided 2026-10-13): book files are in Cloudflare R2 behind the `books` Edge Function that enforces a per-account cloud quota (free ≈ 300 MB, premium ≈ 10 GB, the number lives on the server); premium subscription $5/month through the App Store with the Small Business Program (15%). Estimated cost for 1000 users ≈ $26/month (Supabase Pro $25 + R2 ~$1).

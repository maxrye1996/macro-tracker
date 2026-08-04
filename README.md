# TrackRyte

A private, offline daily tracker. You define what you track — calories, protein, water,
salt, a medication dose, steps — set your own targets, and log numbers by hand. There is no
food database, no account and no server.

Everything is stored in the browser's local storage on the device. What you log is never
sent anywhere, on any build.

The hosted web demo counts anonymous page views through Vercel Analytics: no cookies, no
identifiers, nothing about the data you enter. The packaged iOS/Android app ships no
analytics and is blocked from making any network request whatsoever — see
[Build targets](#build-targets).

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `localhost:3000` |
| `npm run build` | Static export into `out/` |
| `npm start` | Serves the built `out/` to check the real production bundle |
| `npm test` | Compiles `src/lib` and runs the data-layer tests on Node's test runner |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm run sync` | Build, then copy the bundle into the native projects |
| `npm run ios` / `npm run android` | Sync and open Xcode / Android Studio |

## How it is built

Next.js App Router in **static export mode** (`output: "export"`). That is a security
constraint as much as a packaging one: with no server, no API routes and no middleware,
there is no code path that could send a user's data anywhere. The same `out/` bundle is
what Capacitor wraps to build the iOS and Android apps.

```
src/lib/          data layer, no React, fully unit-tested
  trackers.ts     the Tracker type, input sanitising, value limits, colour palette
  schema.ts       persisted shapes + the parsers that guard every read
  storage.ts      the only module that touches localStorage
  store.ts        external store behind useSyncExternalStore; all mutations
  csv.ts          export/import
  date.ts         local-timezone day keys
src/components/   UI, one CSS module each
```

### Storage layout

One key per day, namespaced `mt.v2.`:

```
mt.v2.settings          { v, createdAt, trackers: [...] }
mt.v2.index             { v, days: ["2026-08-01", ...] }
mt.v2.day.2026-08-01    { v, date, entries: [{ id, trackerId, amount, at }] }
```

Splitting by day matters: adding an entry rewrites one small key, so the cost of a tap stays
constant whether you have a week or five years of history. Days are parsed lazily and held
in a bounded in-memory cache (32 entries), so stepping back through history never loads the
whole log.

If the index key is ever lost or corrupted, it is rebuilt by scanning the app's own keys —
a lost index never hides your history.

## Security decisions

- **`connect-src` decides whether the app can reach a network at all.** The mobile build
  gets `'none'`, so "your data never leaves the device" does not depend on nobody ever
  adding a `fetch` by accident — the browser makes it impossible. The web build gets
  `'self'` for the analytics beacon, which still means no third-party host is reachable.
  Dev adds websockets for hot reload. See [Build targets](#build-targets).
- **Every read from storage is re-validated.** localStorage can be edited by hand, corrupted
  by a half-finished write, or written by a different version of the app. Parsers in
  `schema.ts` read field by field and never spread parsed JSON into app state, which is also
  what stops a `__proto__` key reaching a prototype.
- **Tracker names and units are free text**, so they are sanitised on the way in *and* on the
  way out: control characters and bidi overrides stripped, length capped. A stored colour is
  a palette id, never a raw CSS value.
- **CSV export escapes formula characters.** A tracker named `=1+1` would otherwise execute
  when the user opened their own backup in a spreadsheet. The prefix is stripped on import.
- **Import is bounded and defensive**: size- and row-capped, every field re-validated, and
  unreadable rows skipped and counted rather than aborting the whole restore.
- No `dangerouslySetInnerHTML` anywhere; ESLint enforces it.
- No web fonts and no icons from a CDN — nothing is fetched from a third-party origin. The
  dependency tree is Next, React, Capacitor and `@vercel/analytics` (web build only).

## Build targets

`NEXT_PUBLIC_BUILD_TARGET` picks which of two policies gets compiled in. `npm run build`
produces the web build; `npm run sync` sets `mobile` before building, so the native apps
can only ever be made from the locked-down one.

| | web (`out/` on Vercel) | mobile (Capacitor) |
| --- | --- | --- |
| `connect-src` | `'self'` | `'none'` |
| Analytics | Vercel Analytics, same-origin beacon | none — the component is not rendered |
| CSP delivered by | HTTP header from `vercel.json` | `<meta>` tag; there is no server |

`src/lib/csp.ts` is the single source of the policy string and `src/lib/csp.test.ts` fails
the build if `vercel.json` drifts from it, if the mobile target ever loses `connect-src
'none'`, or if any directive other than `connect-src` differs between the two.

## Performance notes

- ~193 KB of gzipped JavaScript on first load. That is essentially all React plus the Next
  App Router runtime — the app's own code is a rounding error. In the packaged mobile apps
  it is a local file read, so the cost is parse/execute rather than download. If cold start
  ever matters more than the framework's conveniences, this app would fit in a fraction of
  that without the App Router.
- Thermometer fills animate via a CSS custom property so progress runs on the compositor:
  no per-frame React work when several update at once.
- Day totals and entry ordering are memoised against the day's entries, so typing in a
  quick-add box does not recompute them.
- The tracker rail is pure CSS scroll-snap. Beyond three trackers the cards narrow slightly
  so the next one is always half-visible — that peek is the entire scroll affordance, with
  no scroll listener.

## Data durability

There is no server, so there is no backup but the one you take. **Export a CSV before
changing phone, clearing browser data or reinstalling.** Settings has Export, Import and a
plain-text fallback for webviews that refuse blob downloads.

iOS can evict a webview's local storage after around seven days of non-use, which affects
the PWA/browser build more than the packaged app. Moving to Capacitor Preferences (native
`UserDefaults` / `SharedPreferences`) would remove that risk and means reimplementing
`storage.ts` and nothing else.

### CSV format

One flat table, readable in any spreadsheet:

```
type,date,tracker_id,name,unit,amount,logged_at,colour,archived
tracker,,t-cal,Calories,kcal,2000,,amber,false
entry,2026-08-01,t-cal,Calories,kcal,450,2026-08-01T08:30:00.000Z,,
```

`tracker` rows define a tracker (`amount` is its daily target); `entry` rows are logged
values. Entries match a tracker by id, falling back to name, so a hand-edited file works.
Import **replaces** everything on the device — merging would silently double every entry if
you imported the same file twice.

## Behaviour worth knowing

- **Removing a tracker never destroys data.** One with logged history is archived: it leaves
  the daily view but keeps every entry and still appears in exports, and can be restored.
  One that was never used has nothing to preserve, so it is simply deleted.
- **Days roll over at local midnight**, re-checked whenever the app returns to the
  foreground, so a backgrounded phone never shows a stale day.
- **You can log into the past** but never into the future.
- Limits: 20 trackers, 500 entries per day, values from 1 to 1,000,000.

## Mobile

The native projects are not committed yet. Once you customise icons, splash screens or
permissions, that config lives in `ios/` and `android/` and should be committed — drop them
from `.gitignore` at that point.

**Android** — Android Studio bundles the SDK and a JDK:

```
brew install --cask android-studio
npm run build && npx cap add android
npm run android
```

**iOS** — needs full Xcode, not just the Command Line Tools:

```
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
brew install cocoapods
npm run build && npx cap add ios
npm run ios
```

After any web change, `npm run sync` rebuilds and copies into both projects.

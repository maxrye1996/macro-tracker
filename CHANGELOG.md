# Changelog

Version lives in `src/lib/version.ts` and is pushed into `package.json` and
`android/app/build.gradle` by `npm run version:sync` (which `npm run build`
and `npm run sync` both call). Bump the constant, add an entry here, build.

Play Store `versionCode` is derived from the version: `0.0.2` is 2, `0.1.0`
is 100, `1.2.3` is 10203.

## 0.0.7 — 2026-08-17

- **Added: history graph.** A new History view — the chart icon, top right —
  plots one tracker's daily totals over time as a line chart, with a dashed
  line marking its target. Pick any active tracker; one at a time for now.
  Drawn as inline SVG with no charting library, so the app still downloads
  nothing and makes no network requests.

## 0.0.6 — 2026-08-17

- **Added: goals as well as limits.** A tracker can now be a *goal* (reach at
  least the target — water, a daily creatine dose, dog walks) rather than a
  *limit* (stay under it — calories, caffeine). A goal reads as "N to go", then
  "N over target" once you pass it, and its card turns green when met. Choose
  per tracker in first-run setup and in Settings. Every existing tracker, and
  every older backup, stays a limit, so nothing about an existing install
  changes.

## 0.0.5 — 2026-08-17

- **Fixed: Export CSV did nothing in the installed app.** The webview can't save
  a `blob:` download the way a browser can, so the button reported success but
  produced no file. The app now writes the CSV and opens the system share sheet,
  so you can save the backup to Files, Drive, email or anywhere else. The web
  export is unchanged, and no network is involved — the share happens entirely
  on-device.

## 0.0.4 — 2026-08-12

- **Fixed: add-tracker validation appeared at the top of Settings.** When a new
  tracker was missing its target (or name), the error showed in the panel
  header, away from the form. It now shows on the tracker's own card, right
  above the Cancel and Add tracker buttons, and clears as you type.

## 0.0.3 — 2026-08-12

Everything since the first closed-test build: fixes found in testing and the
first round of tester requests. (0.0.2 was never released on its own — its
changes ship here.)

- **Reworked the starter suggestions.** Dropped Steps, Carbs, Fat, Sugar and
  Salt. Renamed Caffeine to Coffee, measured in cups. Added Baby feeds (oz) and
  Creatine (doses). Every suggestion still ships with a blank target.
- **Suggestions now appear when adding a tracker in Settings,** not just on
  first run. Ones you already have a tracker for are hidden.
- **Fixed: settings opened off-screen with several trackers.** With more than
  a few trackers the page's layout viewport grew wider than the screen, and
  the settings dialog centred itself in that inflated area. Text inputs no
  longer contribute intrinsic width, and the dialog now positions against the
  visual viewport. It also follows the on-screen keyboard, so a focused field
  is never hidden behind it.
- **Fixed: target and unit fields were cramped on narrow screens.** They now
  split the row equally instead of the unit taking a fixed width.
- **Added: appearance setting** (System / Light / Dark) in Settings. Defaults
  to System, so an existing install is unchanged. A forced theme is applied
  before first paint, so there is no flash of the wrong theme at launch.
- **Added: Follow TrackRyte on Facebook** link in Settings. Opens in the
  system browser; the app itself still makes no network requests.
- **Added: version number** shown at the bottom of Settings.

## 0.0.1 — 2026-08-09

First build submitted to Google Play closed testing.

- User-defined trackers (up to 20), each with its own colour, unit and daily
  target, with a thermometer and quick-add per tracker.
- Day view with history; days roll over at local midnight.
- CSV export and import, including a plain-text fallback for webviews that
  block downloads.
- Removing a tracker with history archives it rather than deleting data.
- Everything stored in local storage. The mobile build is blocked from making
  any network request at all (`connect-src 'none'`).

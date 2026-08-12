# Changelog

Version lives in `src/lib/version.ts` and is pushed into `package.json` and
`android/app/build.gradle` by `npm run version:sync` (which `npm run build`
and `npm run sync` both call). Bump the constant, add an entry here, build.

Play Store `versionCode` is derived from the version: `0.0.2` is 2, `0.1.0`
is 100, `1.2.3` is 10203.

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

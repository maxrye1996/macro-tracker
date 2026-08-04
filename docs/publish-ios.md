# Publishing TrackRyte to the App Store (new developer account)

Costs **$99/year**. Unlike Google Play, Apple has **no mandatory testing period** for new
accounts — ironically, a brand-new iOS app can go live *faster* than a brand-new Android
one. Realistic total time from nothing to live: **3–7 days**, most of it enrolment and
review queues.

## Step 1 — Enrol in the Apple Developer Program

1. You need an Apple ID with two-factor authentication enabled.
2. Enrol at <https://developer.apple.com/programs/enroll/> as an **Individual** (your
   legal name becomes the "seller" name on the store; an Organisation account shows a
   company name instead but needs a D-U-N-S number — days of extra delay).
3. Pay $99. Enrolment approval is usually 24–48 hours, occasionally longer if Apple
   wants identity documents.

## Step 2 — One-time prep on this Mac and in this repo

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer  # full Xcode, not CLT
brew install cocoapods
npx cap add ios                          # generates ios/ with appId com.trackryte.app
npx @capacitor/assets generate --ios     # icons + splash from assets/
npm run sync                             # mobile build (connect-src 'none') into ios/
```

Then remove `ios/` from `.gitignore` and commit it.

In Xcode (`npm run ios` opens it):

- **Signing & Capabilities** → set your Team (appears after enrolment). Xcode
  auto-registers the bundle ID `com.trackryte.app` and manages certificates/profiles —
  do not create these manually on the developer portal, automatic signing is fine.
- **General** → set Version `1.0.0` and Build `1` (Build must increase every upload).
- In `ios/App/App/Info.plist` add `ITSAppUsesNonExemptEncryption` = `NO` — the app only
  uses standard HTTPS/no networking, and this key skips the export-compliance question
  on every single upload.

## Step 3 — Create the app record in App Store Connect

<https://appstoreconnect.apple.com> → **My Apps → + → New App**:

- Platform iOS, Bundle ID `com.trackryte.app`, SKU anything (e.g. `trackryte-ios`).
- **Name "TrackRyte"** — app names are globally unique; claim it as soon as enrolment
  clears, even before you upload a build.

## Step 4 — Store listing requirements

| Item | Requirement |
| --- | --- |
| Screenshots | 6.9" iPhone set required (1320×2868 or 1290×2796, portrait). Take them in the Xcode Simulator (iPhone 16 Pro Max: ⌘S). iPad screenshots are also required **unless** you restrict the app to iPhone-only (Xcode → General → untick iPad) — recommended for v1, one less asset set and one less layout to test. |
| Description, keywords | Description ≤4000 chars; keyword field 100 chars, comma-separated. |
| **Privacy policy URL** | **Required. Does not exist yet — add a `/privacy` page to the website first** (same page serves Google Play). |
| Support URL | Any page on your domain. |
| Age rating | Questionnaire — all "None" gives 4+. |
| **App Privacy** | Declare **"Data Not Collected"**. True for the iOS build: no network access at all (`connect-src 'none'`, no analytics code in the bundle). Apple shows this as the privacy "nutrition label" — it's TrackRyte's best marketing asset, don't undersell it. |

Also under **App Review Information**: no sign-in exists, so tick "no account needed";
add your contact details for the reviewer.

## Step 5 — Upload the build

1. `npm run sync` (always — never archive a stale web bundle).
2. Xcode: select **Any iOS Device (arm64)** → **Product → Archive**.
3. Organizer window → **Distribute App → App Store Connect → Upload**.
4. Wait ~15–60 min for processing in App Store Connect, then select the build on the
   version page.

**TestFlight (optional but wise):** once processing finishes, add yourself + partner as
internal testers and use the app on a real phone for a day before submitting. Internal
testing needs no review and catches webview-vs-browser surprises (safe areas, keyboard,
localStorage persistence after force-quit).

## Step 6 — Submit for review

- Submit from the version page. First-app reviews typically take **24–48 hours**; be
  ready for one rejection round (common for first submissions — usually metadata or a
  screenshot query, fixable same-day).
- Likely reviewer question for TrackRyte: **Guideline 4.2 (minimum functionality)** —
  webview-wrapper apps get scrutiny. Mitigation: the app works fully offline, has native
  safe-area handling, and does something clearly useful; if questioned, reply explaining
  it's an offline-first tracker, not a repackaged website.
- Choose manual or automatic release after approval.

## Ongoing

- $99 renews yearly — if it lapses, the app is **removed from sale** (not deleted).
- Every update: bump Build number, `npm run sync`, Archive, upload, submit. Review on
  updates is usually faster than the first one.

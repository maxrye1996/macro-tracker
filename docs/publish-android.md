# Publishing TrackRyte to Google Play (new developer account)

Costs **$25 once**. The critical thing to know up front: as a **new personal developer
account** you cannot publish straight to production. Google requires you to run a
**closed test with at least 12 testers, continuously for 14 days**, before you can even
apply for production access. Submitting a build this week is realistic; being live in the
store is roughly **three weeks away**, and the clock only starts when your 12 testers are
opted in. Recruit them first.

## Step 1 — Create the developer account (start today; verification takes days)

1. Go to <https://play.google.com/console/signup> and sign in with the Google account you
   want to own the app long-term (not a throwaway — transferring later is painful).
2. Choose **Personal** account type (organisation accounts skip the 14-day testing rule
   but require registered-business documents).
3. Pay the $25 fee.
4. Complete **identity verification** — government ID + proof of address. This can take
   from hours to several days, and you cannot publish anything until it clears. Google
   will also verify by postcard/phone in some regions.
5. Note: your **developer name** is public; your **contact email and country** are shown
   on the store listing for personal accounts.

## Step 2 — One-time prep in this repo

```bash
brew install --cask android-studio     # bundles the SDK and a JDK
npx cap add android                    # generates android/ with appId com.trackryte.app
npx @capacitor/assets generate --android   # icons + splash from assets/
npm run sync                           # mobile build (connect-src 'none') into android/
```

Then remove `android/` from `.gitignore` and commit it — icon config and signing config
live there now.

**Version numbers:** in `android/app/build.gradle`, set `versionCode 1` (integer, must
increase every upload) and `versionName "1.0.0"` (what users see).

## Step 3 — Signing key (do not lose this)

Play uses **Play App Signing**: Google holds the real signing key, you hold an *upload
key*. Create the upload keystore:

```bash
keytool -genkey -v -keystore trackryte-upload.keystore \
  -alias trackryte -keyalg RSA -keysize 2048 -validity 10000
```

- Store the keystore and its passwords in your password manager **and** somewhere
  offline. If you lose it you can ask Google to reset the upload key, but it costs days.
- Never commit the keystore. Add `*.keystore` to `.gitignore`.
- Wire it into `android/app/build.gradle` as a `signingConfig` for the `release` build
  type (Android Studio: **Build → Generate Signed App Bundle** walks you through it).

## Step 4 — Build the bundle

```bash
npm run sync
cd android && ./gradlew bundleRelease
# → android/app/build/outputs/bundle/release/app-release.aab
```

(Or Android Studio: **Build → Generate Signed App Bundle → release**.)

## Step 5 — Things to prepare before the Console will accept the app

| Item | Requirement |
| --- | --- |
| App icon | 512×512 PNG (export from `assets/icon.png`) |
| Feature graphic | 1024×500 PNG — required, shown at the top of the listing |
| Phone screenshots | At least 2, each ≥1080px on the short side (screenshot the app in an emulator) |
| Short description | ≤80 characters |
| Full description | ≤4000 characters |
| **Privacy policy URL** | **Required. Does not exist yet — add a `/privacy` page to the website first.** |

## Step 6 — Create the app in Play Console and fill in the declarations

**Create app** → name *TrackRyte*, default language, App (not game), Free. Free is
permanent — a free app can never become paid (in-app purchases can be added, though).

Then work through **App content** (all mandatory):

- **Privacy policy** — the URL from step 5.
- **Data safety** — because the Android build makes *zero* network requests
  (`connect-src 'none'`, no analytics module in the bundle), declare **"No data
  collected"** and **"No data shared"**. Truthful and audit-proof here.
- **Content rating** — IARC questionnaire. Answer honestly (no violence, no user
  content); you'll get Everyone/PEGI 3.
- **Target audience** — 18+, or 13+ if you like; do **not** tick under-13 (that triggers
  Families policy requirements).
- **Ads declaration** — contains no ads.
- **Health apps declaration** — Play now asks whether the app is health-related. A
  self-logged nutrition tracker fits "health and fitness"; declare it and state that all
  data stays on-device. This does not require extra approval for manual-entry trackers.

## Step 7 — Closed testing (the 14-day gate)

1. **Testing → Closed testing → Create track**, upload the `.aab`.
2. Add testers by email list or Google Group — **you need 12+ opted in, continuously,
   for 14 days**.
3. Send testers the opt-in link; they must accept AND install.
4. First upload to any track goes through review (usually hours to ~2 days for a new
   account).
5. After 14 days with 12+ testers, the Console unlocks **Apply for production access**;
   you answer a short questionnaire about your testing.
6. Approval → promote the same build to Production. Production review for a first app:
   typically 1–7 days.

## Realistic timeline from today

| Day | Milestone |
| --- | --- |
| Day 0–2 | Account created, ID verification clears; recruit 12 testers |
| Day 1–3 | `cap add android`, icons, keystore, first `.aab` built |
| Day 3–4 | Listing assets + privacy page done, closed-testing build **submitted** ✅ |
| Day 4–18 | 14-day closed test runs (fix anything testers find) |
| Day 18–21 | Apply for production, review, **live** |

"Submitted this week" is achievable. "Live this week" is not — that's a Google policy
wall, not an effort problem.

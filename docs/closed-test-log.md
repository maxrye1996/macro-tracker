# Closed test log

Notes from the TrackRyte closed test. The point of keeping this is the
production-access form that unlocks around day 15 asks what happened during
testing, and I'd rather answer from notes than from memory. New stuff goes at
the bottom.

## Who's testing

15 testers, all people I know, invited one at a time by message with the opt-in
link. Everyone's on a real Android phone. They're the kind of people the app is
for: adults who already track some daily number by hand, whether that's
calories, water or medication, and want something private that works offline.
Feedback comes back to me over DM.

## Timeline

### 2026-08-09 — v1 out to closed testing

versionCode 1, first build on the closed track. I pushed it through the internal
testing track first so I could install it from the store on my own phone and
check the whole flow worked before real testers touched it.

### 2026-08-10 — settings dialog opening off-screen

Found in testing. With 8 trackers set up, the settings dialog was opening
outside the visible screen. Turned out the off-screen tracker cards still
carried intrinsic width, which inflated the layout viewport and threw the
centering off. Fixed it the same day: inputs no longer add intrinsic width, and
the dialog now pins to the visual viewport.

While I was in there I also fixed the target and unit fields being cramped on
narrower phones (samsung flip). A tester flagged it. They're a 50/50 split now.

### 2026-08-11 — testers installing, first feature requests

Two things came out of early feedback and are queued for v2:

- An appearance setting (System / Light / Dark). A tester wanted the dark look
  everywhere, not just where the system decided.
- A Follow-on-Facebook link in Settings.

### 2026-08-12 — v0.0.3, and reworking the suggestions

Bundled everything up into 0.0.3 for the closed track (0.0.2 never went out on
its own, so its changes ride along here). Also reworked the starter suggestions
around who's actually testing: dropped Steps and the macro breakdowns (Carbs,
Fat, Sugar, Salt), renamed Caffeine to Coffee measured in cups, and added Baby
feeds (oz) and Creatine (doses). The suggestions now show up in the Settings
add-tracker screen too, not just on first run.

### 2026-08-12 — v0.0.4, add-tracker validation fix

More tester feedback: adding a tracker without a target put the validation
message at the very top of the Settings panel, nowhere near the button you'd
just tapped. Moved it onto the tracker's own card, above the Cancel and Add
tracker buttons, and it clears as you start typing.

### 2026-08-17 — v0.0.5, export fix in the app

Tester reported Export CSV worked fine on the website but did nothing in the
installed app. The Android webview can't handle the blob download a browser
does, and it failed silently, so the app even claimed it had exported. Switched
the app to write the file and open the native share sheet (Save to Files, Drive,
email, and so on); the web export is untouched. This needed two Capacitor
plugins (Filesystem and Share), so it's the first build that's more than a
straight web-into-webview package.

<!-- New entry template:

### YYYY-MM-DD — short heading
What happened: feedback, a bug, a release. And what changed because of it.

-->

# Closed test log

Running record of the TrackRyte closed test, kept so the production-access
application (unlocks ~day 15) can be answered with specifics instead of
generalities. Add entries as they happen — feedback, fixes, releases, tester
count changes.

## Test setup

- **Recruited:** 15 testers, personal contacts of the developer, invited
  individually via message with the opt-in link. All real Android phone
- **Audience:** adults who already track daily numbers by hand (calories,
  water, medication) and want a private, offline tool.
- **Feedback channel:** direct messages to the developer.

## Timeline

### 2026-08-09 — v1 (versionCode 1) submitted
First release to closed testing. Internal testing track used first to verify
the store install flow end-to-end on the developer's own device.

### 2026-08-10 — bug: settings dialog opened off-screen (found in testing)
With 8 trackers, the settings dialog opened outside the visible screen on
phones — the layout viewport inflated because off-screen tracker cards
carried intrinsic width. Diagnosed and fixed the same day (inputs no longer
contribute intrinsic width; dialog pins to the visual viewport). Also fixed
in the same session: target/unit fields were cramped on slimmer screens
(now a 50/50 split, from tester feedback).

### 2026-08-11 — testers joining; feature work from feedback
6 testers installed on day one, remainder being chased. Built from early
feedback: an appearance setting (System / Light / Dark — tester preferred
the dark look everywhere), and a Follow-on-Facebook link in Settings.
Queued for v2.

<!-- Template for new entries:

### YYYY-MM-DD — what happened
Feedback received / bug found / release shipped, and what changed because
of it.

-->

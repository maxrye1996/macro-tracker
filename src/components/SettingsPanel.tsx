"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { csvFilename } from "@/lib/csv";
import type { Settings } from "@/lib/schema";
import { IS_MOBILE_BUILD } from "@/lib/target";
import { shareCsvNatively } from "@/lib/native-export";
import { getThemePref, setThemePref, type ThemePref } from "@/lib/theme";
import { VERSION } from "@/lib/version";
import {
  addTracker,
  buildExport,
  countEntries,
  deleteEverything,
  importFromCsv,
  moveTracker,
  removeTracker,
  restoreTracker,
  updateTracker,
  type AppState,
} from "@/lib/store";
import {
  colourVar,
  MAX_TRACKERS,
  nextColour,
  sanitiseName,
  SUGGESTIONS,
  VALUE_MAX,
  type Suggestion,
  type Tracker,
} from "@/lib/trackers";
import { TrackerFields, type TrackerDraftValues } from "./TrackerFields";
import styles from "./SettingsPanel.module.css";

/** Refuse to read anything larger than a plausible backup into memory. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

type Status = { readonly tone: "info" | "error"; readonly text: string } | null;

const THEME_OPTIONS: readonly { value: ThemePref; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function toDraft(tracker: Tracker): TrackerDraftValues {
  return {
    name: tracker.name,
    unit: tracker.unit,
    target: String(tracker.target),
    colour: tracker.colour,
  };
}

interface Props {
  readonly state: AppState;
  readonly settings: Settings;
  readonly onClose: () => void;
}

export function SettingsPanel({ state, settings, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  /** In-progress edits, keyed by tracker id. Cleared once committed. */
  const [edits, setEdits] = useState<Record<string, TrackerDraftValues>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [newDraft, setNewDraft] = useState<TrackerDraftValues | null>(null);
  // Validation for the in-progress new tracker, shown inline on its card
  // (above the Cancel/Add buttons) rather than in the top-of-panel status.
  const [newError, setNewError] = useState<string | null>(null);
  // Lazy initialiser: the dialog only ever mounts client-side, after hydration,
  // so reading localStorage here is safe.
  const [theme, setTheme] = useState<ThemePref>(() => getThemePref());

  // `showModal` gives a real focus trap, inert background and Escape-to-close
  // without shipping a modal library.
  //
  // The inline positioning exists because mobile engines (Android WebView and
  // Chrome) sometimes lay the page out wider than the screen — with enough
  // trackers, the rail's off-screen inputs make the browser inflate the layout
  // viewport. A dialog centred with CSS centres in that inflated viewport and
  // can land entirely off the visible screen. Pinning to the *visual* viewport
  // is correct no matter what the layout viewport is doing; when the two match
  // (every desktop browser), this computes the exact same centred geometry the
  // CSS would.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();

    const vv = window.visualViewport;
    if (!vv) return;
    const pin = () => {
      const width = Math.min(560, vv.width);
      dialog.style.margin = "0";
      dialog.style.left = `${vv.offsetLeft + (vv.width - width) / 2}px`;
      dialog.style.top = `${vv.offsetTop}px`;
      dialog.style.width = `${width}px`;
      dialog.style.height = `${vv.height}px`;
    };
    pin();
    // Follows the visual viewport while open: panning a zoomed page, rotation,
    // and the on-screen keyboard (which shrinks vv.height, keeping the focused
    // field visible instead of hiding it behind the keyboard).
    vv.addEventListener("resize", pin);
    vv.addEventListener("scroll", pin);
    return () => {
      vv.removeEventListener("resize", pin);
      vv.removeEventListener("scroll", pin);
    };
  }, []);

  const active = settings.trackers.filter((t) => !t.archived);
  const archived = settings.trackers.filter((t) => t.archived);
  const dayCount = state.loggedDays.length;

  // Suggestions the user hasn't already got a tracker for (active or archived),
  // so the same name is never offered twice.
  const remainingSuggestions = useMemo(() => {
    const taken = new Set(settings.trackers.map((t) => t.name.trim().toLowerCase()));
    return SUGGESTIONS.filter((s) => !taken.has(s.name.toLowerCase()));
  }, [settings.trackers]);

  // Starts a new-tracker draft prefilled from a suggestion. Name and unit come
  // from the suggestion; the target is left blank for the user to set, same as
  // the first-run flow — the app ships no recommended values.
  const startSuggestion = (suggestion: Suggestion) => {
    setNewError(null);
    setNewDraft({
      name: suggestion.name,
      unit: suggestion.unit,
      target: "",
      colour: settings.trackers.some((t) => t.colour === suggestion.colour)
        ? nextColour(settings.trackers)
        : suggestion.colour,
    });
  };

  // Counting scans every logged day, so only do it when the section is shown.
  // `countEntries` reads the store directly rather than taking arguments, so
  // `loggedDays` is listed to re-run the count when the history changes even
  // though the lint rule cannot see the dependency.
  const archivedCounts = useMemo(
    () =>
      new Map(
        settings.trackers.filter((t) => t.archived).map((t) => [t.id, countEntries(t.id)] as const),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [settings.trackers, state.loggedDays],
  );

  const commitTracker = (tracker: Tracker, override?: Partial<TrackerDraftValues>) => {
    const draft = { ...(edits[tracker.id] ?? toDraft(tracker)), ...override };
    const result = updateTracker(tracker.id, {
      name: draft.name,
      unit: draft.unit,
      target: draft.target,
      colour: draft.colour,
    });

    if (result !== "added") {
      setErrors((prev) => ({
        ...prev,
        [tracker.id]:
          sanitiseName(draft.name) === ""
            ? "Give this tracker a name."
            : `Set a target between 1 and ${VALUE_MAX.toLocaleString()}.`,
      }));
      return;
    }
    // Drop the local copy so the row re-derives from what was actually stored.
    setErrors((prev) => {
      const next = { ...prev };
      delete next[tracker.id];
      return next;
    });
    setEdits((prev) => {
      const next = { ...prev };
      delete next[tracker.id];
      return next;
    });
  };

  const remove = (tracker: Tracker) => {
    const outcome = removeTracker(tracker.id);
    setStatus({
      tone: "info",
      text:
        outcome === "archived"
          ? `${tracker.name} archived. Its history is kept and still exports.`
          : `${tracker.name} removed. It had nothing logged against it.`,
    });
  };

  const cancelAdd = () => {
    setNewDraft(null);
    setNewError(null);
  };

  const confirmAdd = () => {
    if (!newDraft) return;
    const result = addTracker({
      name: newDraft.name,
      unit: newDraft.unit,
      target: newDraft.target,
      colour: newDraft.colour,
    });
    if (result === "full") {
      setNewError(`You can have at most ${MAX_TRACKERS} trackers.`);
      return;
    }
    if (result === "invalid") {
      setNewError(
        sanitiseName(newDraft.name) === ""
          ? "Give the new tracker a name."
          : `Set a target between 1 and ${VALUE_MAX.toLocaleString()}.`,
      );
      return;
    }
    setNewDraft(null);
    setNewError(null);
    setStatus({ tone: "info", text: `${sanitiseName(newDraft.name)} added.` });
  };

  const exportCsv = async () => {
    const csv = buildExport();
    if (!csv) {
      setStatus({ tone: "error", text: "Nothing to export yet." });
      return;
    }

    // The webview can't download a blob: URL, so the packaged app writes the
    // file and opens the native share sheet instead.
    if (IS_MOBILE_BUILD) {
      const shared = await shareCsvNatively(csv, csvFilename());
      if (shared) {
        setStatus({ tone: "info", text: `Exported ${dayCount} day${dayCount === 1 ? "" : "s"}.` });
      } else {
        setCsvText(csv);
        setStatus({ tone: "info", text: "Couldn't open the share sheet — copy the text below." });
      }
      return;
    }

    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = csvFilename();
      link.rel = "noopener";
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoke on a delay; revoking synchronously cancels the download in
      // some webviews.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setStatus({ tone: "info", text: `Exported ${dayCount} day${dayCount === 1 ? "" : "s"}.` });
    } catch {
      // Some webviews refuse blob downloads; fall back to showing the text.
      setCsvText(csv);
      setStatus({ tone: "info", text: "Download unavailable here — copy the text below." });
    }
  };

  const showCsv = () => {
    const csv = buildExport();
    setCsvText(csv || "");
    setStatus(csv ? null : { tone: "error", text: "Nothing to export yet." });
  };

  const copyCsv = async () => {
    const csv = csvText ?? buildExport();
    try {
      await navigator.clipboard.writeText(csv);
      setStatus({ tone: "info", text: "Copied to clipboard." });
    } catch {
      setStatus({ tone: "error", text: "Couldn't copy — select the text and copy manually." });
    }
  };

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset immediately so re-picking the same file fires change again.
    event.target.value = "";
    if (!file) return;

    if (file.size > MAX_IMPORT_BYTES) {
      setStatus({ tone: "error", text: "That file is too large to be a TrackRyte backup." });
      return;
    }

    const proceed = window.confirm(
      "Importing replaces all trackers and entries currently on this device. Continue?",
    );
    if (!proceed) return;

    let text: string;
    try {
      text = await file.text();
    } catch {
      setStatus({ tone: "error", text: "Couldn't read that file." });
      return;
    }

    const report = importFromCsv(text);
    if (!report.ok) {
      setStatus({ tone: "error", text: report.error });
      return;
    }
    const { days, entries, trackers, skipped } = report.summary;
    setEdits({});
    setStatus({
      tone: "info",
      text: `Imported ${trackers} tracker${trackers === 1 ? "" : "s"} and ${entries} entries across ${days} day${
        days === 1 ? "" : "s"
      }${skipped > 0 ? `, skipped ${skipped} unreadable row${skipped === 1 ? "" : "s"}` : ""}.`,
    });
  };

  const doDelete = () => {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    deleteEverything();
    onClose();
  };

  return (
    <dialog ref={dialogRef} className={styles.dialog} onClose={onClose} aria-label="Settings">
      <div className={styles.inner}>
        <div className={styles.head}>
          <h2 className={styles.title}>Settings</h2>
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Close settings"
          >
            ×
          </button>
        </div>

        {status && (
          <p
            className={`${styles.status}${status.tone === "error" ? ` ${styles.statusError}` : ""}`}
            role="status"
          >
            {status.text}
          </p>
        )}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Trackers</h3>
          <p className={styles.blurb}>
            Edits save as you leave each field. Order here is the order they appear on the daily
            view; beyond three, the row scrolls sideways.
          </p>

          <div className={styles.trackerList}>
            {active.map((tracker, index) => (
              <TrackerFields
                key={tracker.id}
                value={edits[tracker.id] ?? toDraft(tracker)}
                error={errors[tracker.id]}
                onChange={(patch) =>
                  setEdits((prev) => ({
                    ...prev,
                    [tracker.id]: { ...(prev[tracker.id] ?? toDraft(tracker)), ...patch },
                  }))
                }
                onCommit={(override) => commitTracker(tracker, override)}
                onRemove={() => remove(tracker)}
                removeLabel="Remove from daily view"
                onMove={(delta) => moveTracker(tracker.id, delta)}
                canMoveUp={index > 0}
                canMoveDown={index < active.length - 1}
              />
            ))}

            {newDraft ? (
              <>
                <TrackerFields
                  value={newDraft}
                  autoFocus
                  error={newError ?? undefined}
                  onChange={(patch) => {
                    setNewError(null);
                    setNewDraft((prev) => (prev ? { ...prev, ...patch } : prev));
                  }}
                  onRemove={cancelAdd}
                  removeLabel="Discard new tracker"
                />
                <div className={styles.draftActions}>
                  <button type="button" className={styles.cancelAdd} onClick={cancelAdd}>
                    Cancel
                  </button>
                  <button type="button" className={styles.confirmAdd} onClick={confirmAdd}>
                    Add tracker
                  </button>
                </div>
              </>
            ) : (
              settings.trackers.length < MAX_TRACKERS && (
                <>
                  {remainingSuggestions.length > 0 && (
                    <div className={styles.suggestChips}>
                      {remainingSuggestions.map((suggestion) => (
                        <button
                          key={suggestion.name}
                          type="button"
                          className={styles.suggestChip}
                          style={{ ["--tint" as string]: colourVar(suggestion.colour) }}
                          onClick={() => startSuggestion(suggestion)}
                        >
                          <span className={styles.suggestDot} aria-hidden="true" />
                          {suggestion.name}
                          {suggestion.unit && (
                            <span className={styles.suggestUnit}>{suggestion.unit}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    className={styles.addTracker}
                    onClick={() => {
                      setNewError(null);
                      setNewDraft({
                        name: "",
                        unit: "",
                        target: "",
                        colour: nextColour(settings.trackers),
                      });
                    }}
                  >
                    + Add tracker
                  </button>
                </>
              )
            )}
          </div>
        </section>

        {archived.length > 0 && (
          <section className={styles.section}>
            <h3 className={styles.sectionTitle}>Archived</h3>
            <p className={styles.blurb}>
              Hidden from the daily view. Every entry is still stored and still included in
              exports.
            </p>
            {archived.map((tracker) => {
              const count = archivedCounts.get(tracker.id) ?? 0;
              return (
                <div
                  key={tracker.id}
                  className={styles.archivedRow}
                  style={{ ["--tint" as string]: colourVar(tracker.colour) }}
                >
                  <span className={styles.archivedSwatch} aria-hidden="true" />
                  <span className={styles.archivedText}>
                    <span className={styles.archivedName}>{tracker.name}</span>
                    <span className={styles.archivedMeta}>
                      {count} entr{count === 1 ? "y" : "ies"} kept
                    </span>
                  </span>
                  <button
                    type="button"
                    className={styles.restore}
                    onClick={() => {
                      if (!restoreTracker(tracker.id)) {
                        setStatus({
                          tone: "error",
                          text: `Archive or remove another tracker first — ${MAX_TRACKERS} is the limit.`,
                        });
                      }
                    }}
                  >
                    Restore
                  </button>
                </div>
              );
            })}
          </section>
        )}

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Appearance</h3>
          <div className={styles.segmented} role="group" aria-label="Theme">
            {THEME_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                className={`${styles.segment}${theme === value ? ` ${styles.segmentActive}` : ""}`}
                aria-pressed={theme === value}
                onClick={() => {
                  setTheme(value);
                  setThemePref(value);
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Backup</h3>
          <p className={styles.blurb}>
            Your log lives only on this device. Export a CSV before changing phone, clearing
            browser data or reinstalling — there is no copy anywhere else.
          </p>
          <div className={styles.actions}>
            <button type="button" className={styles.action} onClick={exportCsv}>
              <span>
                Export CSV
                <span className={styles.actionHint}>
                  {dayCount} day{dayCount === 1 ? "" : "s"} logged
                </span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ↓
              </span>
            </button>

            <button type="button" className={styles.action} onClick={() => fileRef.current?.click()}>
              <span>
                Import CSV
                <span className={styles.actionHint}>Replaces everything on this device</span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ↑
              </span>
            </button>
            <input
              ref={fileRef}
              className={styles.fileInput}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={onFile}
            />

            <button type="button" className={styles.action} onClick={showCsv}>
              <span>
                Show as text
                <span className={styles.actionHint}>If the download doesn&apos;t work</span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ⋯
              </span>
            </button>
          </div>

          {csvText !== null && (
            <>
              <textarea
                className={styles.csvBox}
                readOnly
                value={csvText}
                aria-label="Backup CSV"
                onFocus={(e) => e.currentTarget.select()}
              />
              <button type="button" className={styles.action} onClick={copyCsv}>
                <span>Copy to clipboard</span>
              </button>
            </>
          )}
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Follow</h3>
          <div className={styles.actions}>
            {/* A plain link, not a fetch: it opens in the system browser (the
                webview refuses the navigation), so the app itself still makes
                no network requests. */}
            <a
              className={styles.action}
              href="https://www.facebook.com/profile.php?id=61592952727356"
              target="_blank"
              rel="noreferrer"
            >
              <span>
                Follow TrackRyte on Facebook
                <span className={styles.actionHint}>News and updates</span>
              </span>
              <span className={styles.chevron} aria-hidden="true">
                ›
              </span>
            </a>
          </div>
        </section>

        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>Data</h3>
          <div className={styles.actions}>
            <button
              type="button"
              className={`${styles.action} ${styles.destructive}`}
              onClick={doDelete}
              onBlur={() => setConfirmingDelete(false)}
            >
              <span>
                {confirmingDelete ? "Tap again to erase everything" : "Delete all data"}
                <span className={styles.actionHint}>
                  {confirmingDelete ? "This cannot be undone" : "Every tracker and every logged day"}
                </span>
              </span>
            </button>
          </div>
        </section>

        {/* The installed app and the web demo make genuinely different promises,
            so they say genuinely different things. The absolute claim is only
            made where connect-src 'none' actually enforces it. */}
        <p className={styles.footNote}>
          TrackRyte stores everything in this device&apos;s local storage. It has no account
          system.{" "}
          {IS_MOBILE_BUILD ? (
            <>This app makes no network requests at all, and contains no analytics or tracking.</>
          ) : (
            <>
              This web version counts anonymous page views — no cookies, no identifiers, and never
              anything you log. Your entries and targets stay on this device.
            </>
          )}
        </p>

        {/* Testers reporting a bug need to say which build they are on. */}
        <p className={styles.version}>Version {VERSION}</p>
      </div>
    </dialog>
  );
}

"use client";

import { useMemo, useState } from "react";
import { formatDayLabel, formatTime, type DayKey } from "@/lib/date";
import type { Settings } from "@/lib/schema";
import { totalsFor } from "@/lib/schema";
import { addEntry, goToDate, removeEntry, shiftDay, type AppState } from "@/lib/store";
import { colourVar, formatWithUnit } from "@/lib/trackers";
import { TrackerCard } from "./TrackerCard";
import styles from "./DayScreen.module.css";

interface Props {
  readonly state: AppState;
  readonly settings: Settings;
  readonly onOpenSettings: () => void;
}

export function DayScreen({ state, settings, onOpenSettings }: Props) {
  const [announcement, setAnnouncement] = useState("");
  const { day, viewDate, today } = state;

  const active = useMemo(
    () => settings.trackers.filter((t) => !t.archived),
    [settings.trackers],
  );
  // Includes archived trackers so historical entries still render with their
  // real name and colour rather than going blank.
  const byId = useMemo(
    () => new Map(settings.trackers.map((t) => [t.id, t])),
    [settings.trackers],
  );

  // Totals and ordering are recomputed only when the day's entries change,
  // not on every keystroke in the quick-add inputs.
  const totals = useMemo(() => totalsFor(day), [day]);
  const ordered = useMemo(() => [...day.entries].sort((a, b) => b.at - a.at), [day]);

  return (
    <main className={styles.screen}>
      <header className={styles.topbar}>
        <h1 className={styles.brand}>
          MacroTracro<span className={styles.dot}>.</span>
        </h1>
        <button
          type="button"
          className={styles.iconButton}
          onClick={onOpenSettings}
          aria-label="Settings"
        >
          <GearIcon />
        </button>
      </header>

      {!state.storageOk && (
        <p className={styles.banner} role="alert">
          This browser is blocking local storage, so nothing can be saved. Private browsing mode
          is the usual cause.
        </p>
      )}
      {state.storageOk && state.writeFailed && (
        <p className={styles.banner} role="alert">
          Couldn&apos;t save your last change — device storage may be full. Export a backup and
          free up space.
        </p>
      )}

      <DayNav viewDate={viewDate} today={today} />

      {active.length === 0 ? (
        <div className={styles.noTrackers}>
          <p className={styles.noTrackersText}>
            You have no active trackers. Add one to start logging again.
          </p>
          <button type="button" className={styles.primary} onClick={onOpenSettings}>
            Manage trackers
          </button>
        </div>
      ) : (
        <div
          className={`${styles.rail}${active.length > 3 ? ` ${styles.scrollable}` : ""}`}
          role="group"
          aria-label="Trackers"
        >
          {active.map((tracker) => (
            <TrackerCard
              key={tracker.id}
              tracker={tracker}
              value={totals.get(tracker.id) ?? 0}
              onAdd={(amount) => addEntry(tracker.id, amount)}
              onAdded={setAnnouncement}
            />
          ))}
        </div>
      )}

      {ordered.length === 0 ? (
        <p className={styles.empty}>Nothing logged for this day yet.</p>
      ) : (
        <section className={styles.entries} aria-label="Logged entries">
          <div className={styles.entriesHead}>
            <h2 className={styles.entriesTitle}>Entries</h2>
            <span className={styles.count}>{ordered.length}</span>
          </div>
          <ul className={styles.list}>
            {ordered.map((entry) => {
              const tracker = byId.get(entry.trackerId);
              const name = tracker?.name ?? "Removed tracker";
              const amount = formatWithUnit(entry.amount, tracker?.unit ?? "");
              return (
                <li
                  key={entry.id}
                  className={styles.row}
                  style={{
                    ["--tint" as string]: tracker ? colourVar(tracker.colour) : "var(--text-faint)",
                  }}
                >
                  <span className={styles.swatch} aria-hidden="true" />
                  <span className={styles.rowName}>{name}</span>
                  <span className={styles.rowTime}>{formatTime(entry.at)}</span>
                  <span className={styles.rowAmount}>{amount}</span>
                  <button
                    type="button"
                    className={styles.remove}
                    aria-label={`Remove ${amount} ${name}`}
                    onClick={() => {
                      removeEntry(entry.id);
                      setAnnouncement(`Removed ${amount} ${name}`);
                    }}
                  >
                    ×
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="visually-hidden" role="status" aria-live="polite">
        {announcement}
      </p>
    </main>
  );
}

function DayNav({ viewDate, today }: { readonly viewDate: DayKey; readonly today: DayKey }) {
  const isToday = viewDate === today;
  return (
    <nav className={styles.dayNav} aria-label="Choose day">
      <button
        type="button"
        className={styles.navButton}
        onClick={() => shiftDay(-1)}
        aria-label="Previous day"
      >
        ‹
      </button>
      <span className={styles.dayLabel} aria-live="polite">
        {formatDayLabel(viewDate, today)}
        {!isToday && (
          <button type="button" className={styles.today} onClick={() => goToDate(today)}>
            Today
          </button>
        )}
      </span>
      <button
        type="button"
        className={styles.navButton}
        onClick={() => shiftDay(1)}
        disabled={isToday}
        aria-label="Next day"
      >
        ›
      </button>
    </nav>
  );
}

function GearIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M19.4 13.5a7.7 7.7 0 0 0 0-3l1.7-1.3-1.9-3.3-2 .8a7.7 7.7 0 0 0-2.6-1.5L14.3 3H9.7l-.3 2.2a7.7 7.7 0 0 0-2.6 1.5l-2-.8-1.9 3.3 1.7 1.3a7.7 7.7 0 0 0 0 3l-1.7 1.3 1.9 3.3 2-.8a7.7 7.7 0 0 0 2.6 1.5l.3 2.2h4.6l.3-2.2a7.7 7.7 0 0 0 2.6-1.5l2 .8 1.9-3.3-1.7-1.3Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

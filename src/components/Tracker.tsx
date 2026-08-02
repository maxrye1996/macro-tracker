"use client";

import { useMemo, useState } from "react";
import { formatDayLabel, formatTime, type DayKey } from "@/lib/date";
import { formatAmount, MACRO_LIST, MACROS, type MacroId } from "@/lib/macros";
import type { DayLog, Settings } from "@/lib/schema";
import { totalsFor } from "@/lib/schema";
import { addEntry, goToDate, removeEntry, shiftDay, type AppState } from "@/lib/store";
import { MacroCard } from "./MacroCard";
import styles from "./Tracker.module.css";

const TINTS: Record<MacroId, string> = {
  calories: "var(--calories)",
  protein: "var(--protein)",
  fibre: "var(--fibre)",
};

const TINTS_SOFT: Record<MacroId, string> = {
  calories: "var(--calories-soft)",
  protein: "var(--protein-soft)",
  fibre: "var(--fibre-soft)",
};

interface Props {
  readonly state: AppState;
  readonly settings: Settings;
  readonly onOpenSettings: () => void;
}

export function Tracker({ state, settings, onOpenSettings }: Props) {
  const [announcement, setAnnouncement] = useState("");
  const { day, viewDate, today } = state;

  // Totals and ordering are recomputed only when the day's entries change,
  // not on every keystroke in the three quick-add inputs.
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

      <div className={styles.grid}>
        {MACRO_LIST.map((meta) => (
          <MacroCard
            key={meta.id}
            meta={meta}
            value={totals[meta.id]}
            target={settings.targets[meta.id]}
            tint={TINTS[meta.id]}
            tintSoft={TINTS_SOFT[meta.id]}
            onAdd={(amount) => addEntry(meta.id, amount)}
            onAdded={setAnnouncement}
          />
        ))}
      </div>

      <EntryList day={day} entries={ordered} onAnnounce={setAnnouncement} />

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

interface EntryListProps {
  readonly day: DayLog;
  readonly entries: DayLog["entries"];
  readonly onAnnounce: (message: string) => void;
}

function EntryList({ entries, onAnnounce }: EntryListProps) {
  if (entries.length === 0) {
    return <p className={styles.empty}>Nothing logged for this day yet.</p>;
  }

  return (
    <section className={styles.entries} aria-label="Logged entries">
      <div className={styles.entriesHead}>
        <h2 className={styles.entriesTitle}>Entries</h2>
        <span className={styles.count}>{entries.length}</span>
      </div>
      <ul className={styles.list}>
        {entries.map((entry) => {
          const meta = MACROS[entry.macro];
          const amount = `${formatAmount(entry.amount, entry.macro)} ${meta.unit}`;
          return (
            <li
              key={entry.id}
              className={styles.row}
              style={{ ["--tint" as string]: TINTS[entry.macro] }}
            >
              <span className={styles.swatch} aria-hidden="true" />
              <span className={styles.rowMacro}>{meta.label}</span>
              <span className={styles.rowTime}>{formatTime(entry.at)}</span>
              <span className={styles.rowAmount}>{amount}</span>
              <button
                type="button"
                className={styles.remove}
                aria-label={`Remove ${amount} ${meta.label.toLowerCase()}`}
                onClick={() => {
                  removeEntry(entry.id);
                  onAnnounce(`Removed ${amount} ${meta.label.toLowerCase()}`);
                }}
              >
                ×
              </button>
            </li>
          );
        })}
      </ul>
    </section>
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

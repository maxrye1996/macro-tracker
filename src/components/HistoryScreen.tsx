"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { formatDayLabel } from "@/lib/date";
import type { Settings } from "@/lib/schema";
import { dailyTotalsFor, type AppState } from "@/lib/store";
import { colourVar, formatWithUnit } from "@/lib/trackers";
import { HistoryChart } from "./HistoryChart";
import styles from "./HistoryScreen.module.css";

interface Props {
  readonly state: AppState;
  readonly settings: Settings;
  readonly onClose: () => void;
}

/**
 * A full-screen look at one tracker's history over time. One tracker at a time,
 * active trackers only — archived ones have no live card to compare against.
 */
export function HistoryScreen({ state, settings, onClose }: Props) {
  const closeRef = useRef<HTMLButtonElement>(null);

  const active = useMemo(
    () => settings.trackers.filter((t) => !t.archived),
    [settings.trackers],
  );
  const [selectedId, setSelectedId] = useState(() => active[0]?.id ?? "");
  const selected = active.find((t) => t.id === selectedId) ?? active[0];

  const points = useMemo(
    () => (selected ? dailyTotalsFor(selected.id, state) : []),
    [selected, state],
  );

  // Escape closes, and focus lands on the close button so keyboard users aren't
  // stranded behind the daily view.
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const latest = points[points.length - 1];
  const best = points.length > 0 ? Math.max(...points.map((p) => p.total)) : 0;

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-label="History">
      <div className={styles.panel}>
      <div className={styles.head}>
        <h2 className={styles.title}>History</h2>
        <button
          ref={closeRef}
          type="button"
          className={styles.close}
          onClick={onClose}
          aria-label="Close history"
        >
          ×
        </button>
      </div>

      {active.length === 0 ? (
        <p className={styles.empty}>
          You have no active trackers to chart. Add one from the daily view.
        </p>
      ) : (
        <div className={styles.body}>
          <div className={styles.pickerRow} role="radiogroup" aria-label="Choose a tracker">
            {active.map((tracker) => {
              const on = tracker.id === selected?.id;
              return (
                <button
                  key={tracker.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  className={`${styles.pick}${on ? ` ${styles.pickOn}` : ""}`}
                  style={{ ["--tint" as string]: colourVar(tracker.colour) }}
                  onClick={() => setSelectedId(tracker.id)}
                >
                  <span className={styles.pickDot} aria-hidden="true" />
                  {tracker.name}
                </button>
              );
            })}
          </div>

          {selected && (
            <>
              <p className={styles.summary}>
                {points.length > 0 ? (
                  <>
                    Logged on <strong>{points.length}</strong> day{points.length === 1 ? "" : "s"} ·
                    latest <strong>{formatWithUnit(latest!.total, selected.unit)}</strong>{" "}
                    ({formatDayLabel(latest!.date, state.today)}) · best{" "}
                    <strong>{formatWithUnit(best, selected.unit)}</strong>
                  </>
                ) : (
                  <>No history yet.</>
                )}
              </p>

              <HistoryChart
                points={points}
                target={selected.target}
                direction={selected.direction}
                unit={selected.unit}
                tint={colourVar(selected.colour)}
                ariaLabel={
                  points.length > 0
                    ? `${selected.name} daily totals over ${points.length} day${
                        points.length === 1 ? "" : "s"
                      }. Most recent ${formatWithUnit(latest!.total, selected.unit)}. ${
                        selected.direction === "goal" ? "Goal" : "Limit"
                      } ${formatWithUnit(selected.target, selected.unit)}.`
                    : `No history for ${selected.name} yet.`
                }
              />
            </>
          )}
        </div>
      )}
      </div>
    </div>
  );
}

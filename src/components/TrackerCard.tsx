"use client";

import { useId, useRef, useState } from "react";
import {
  colourVar,
  formatAmount,
  formatWithUnit,
  isGoalMet,
  VALUE_MAX,
  type Tracker,
} from "@/lib/trackers";
import type { AddResult } from "@/lib/store";
import { Thermometer } from "./Thermometer";
import styles from "./TrackerCard.module.css";

interface Props {
  readonly tracker: Tracker;
  readonly value: number;
  readonly onAdd: (amount: number) => AddResult;
  readonly onAdded: (message: string) => void;
}

/**
 * Accepts what a phone keyboard actually produces: a comma decimal separator
 * on European locales, and stray whitespace from paste.
 */
function toNumber(raw: string): number | null {
  const cleaned = raw.trim().replace(",", ".");
  if (cleaned === "" || !/^\d*\.?\d*$/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function TrackerCard({ tracker, value, onAdd, onAdded }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();

  const parsed = toNumber(draft);
  const canSubmit = parsed !== null && parsed > 0;
  const tint = colourVar(tracker.colour);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (parsed === null || parsed <= 0) {
      setError("Enter a number");
      return;
    }
    const result = onAdd(parsed);
    if (result === "invalid") {
      setError(`Must be 1–${VALUE_MAX.toLocaleString()}`);
      return;
    }
    if (result === "day-full") {
      setError("Day is full");
      return;
    }
    setDraft("");
    setError("");
    onAdded(`Added ${formatWithUnit(parsed, tracker.unit)} ${tracker.name}`);
    // Keep focus so the keypad stays up for the next entry.
    inputRef.current?.focus();
  };

  // Positive means still short of the target; negative means past it.
  const remaining = Math.round((tracker.target - value) * 10) / 10;
  const isGoal = tracker.direction === "goal";
  const met = isGoalMet(tracker, value);

  // A limit frames going over as a warning; a goal frames reaching or beating
  // the number as the win.
  let statusText: string;
  let statusTone: "" | "over" | "met";
  if (isGoal) {
    if (remaining > 0) {
      statusText = `${formatAmount(remaining)} to go`;
      statusTone = "";
    } else if (remaining === 0) {
      statusText = "Goal reached";
      statusTone = "met";
    } else {
      statusText = `${formatAmount(-remaining)} over target`;
      statusTone = "met";
    }
  } else if (remaining >= 0) {
    statusText = `${formatAmount(remaining)} left`;
    statusTone = "";
  } else {
    statusText = `${formatAmount(-remaining)} over`;
    statusTone = "over";
  }

  return (
    <section
      className={`${styles.card}${met ? ` ${styles.goalMet}` : ""}`}
      style={{ ["--tint" as string]: tint }}
      aria-labelledby={`${baseId}-label`}
    >
      <h2 className={styles.label} id={`${baseId}-label`} title={tracker.name}>
        {tracker.name}
      </h2>

      <Thermometer
        value={value}
        target={tracker.target}
        tint={tint}
        direction={tracker.direction}
        label={`${tracker.name}: ${formatAmount(value)} of ${formatWithUnit(
          tracker.target,
          tracker.unit,
        )}`}
      />

      <p className={styles.readout}>
        <span className={styles.value}>{formatAmount(value)}</span>
        <span className={styles.target}>of {formatWithUnit(tracker.target, tracker.unit)}</span>
        <span
          className={`${styles.remaining}${
            statusTone === "over" ? ` ${styles.over}` : statusTone === "met" ? ` ${styles.met}` : ""
          }`}
        >
          {statusText}
        </span>
      </p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <label className="visually-hidden" htmlFor={`${baseId}-input`}>
          Add {tracker.name}
          {tracker.unit ? ` (${tracker.unit})` : ""}
        </label>
        <input
          id={`${baseId}-input`}
          ref={inputRef}
          className={`${styles.input}${error ? ` ${styles.invalid}` : ""}`}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={9}
          placeholder="0"
          value={draft}
          aria-describedby={error ? `${baseId}-error` : undefined}
          aria-invalid={error ? true : undefined}
          onChange={(e) => {
            setDraft(e.target.value);
            if (error) setError("");
          }}
        />
        <button
          type="submit"
          className={styles.add}
          disabled={!canSubmit}
          aria-label={`Add ${tracker.name}`}
        >
          +
        </button>
      </form>

      <p className={styles.error} id={`${baseId}-error`}>
        {error}
      </p>
    </section>
  );
}

"use client";

import { useId, useRef, useState } from "react";
import { formatAmount, type MacroMeta } from "@/lib/macros";
import type { AddResult } from "@/lib/store";
import { Thermometer } from "./Thermometer";
import styles from "./MacroCard.module.css";

interface Props {
  readonly meta: MacroMeta;
  readonly value: number;
  readonly target: number;
  readonly tint: string;
  readonly tintSoft: string;
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

export function MacroCard({ meta, value, target, tint, tintSoft, onAdd, onAdded }: Props) {
  const [draft, setDraft] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const errorId = useId();

  const parsed = toNumber(draft);
  const canSubmit = parsed !== null && parsed > 0;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (parsed === null || parsed <= 0) {
      setError("Enter a number");
      return;
    }
    const result = onAdd(parsed);
    if (result === "invalid") {
      setError(`Must be 0–${meta.max.toLocaleString()}`);
      return;
    }
    if (result === "day-full") {
      setError("Day is full");
      return;
    }
    setDraft("");
    setError("");
    onAdded(`Added ${formatAmount(parsed, meta.id)} ${meta.unit} ${meta.label.toLowerCase()}`);
    // Keep focus so the keypad stays up for the next entry.
    inputRef.current?.focus();
  };

  const remaining = Math.round((target - value) * 10) / 10;

  return (
    <section
      className={styles.card}
      style={{ ["--tint" as string]: tint, ["--tint-soft" as string]: tintSoft }}
      aria-labelledby={`${errorId}-label`}
    >
      <h2 className={styles.label} id={`${errorId}-label`}>
        {meta.label}
      </h2>

      <Thermometer
        value={value}
        target={target}
        tint={tint}
        label={`${meta.label}: ${formatAmount(value, meta.id)} of ${formatAmount(
          target,
          meta.id,
        )} ${meta.unit}`}
      />

      <p className={styles.readout}>
        <span className={styles.value}>{formatAmount(value, meta.id)}</span>
        <span className={styles.target}>
          of {formatAmount(target, meta.id)} {meta.unit}
        </span>
        <span className={`${styles.remaining}${remaining < 0 ? ` ${styles.over}` : ""}`}>
          {remaining >= 0
            ? `${formatAmount(remaining, meta.id)} left`
            : `${formatAmount(-remaining, meta.id)} over`}
        </span>
      </p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <label className="visually-hidden" htmlFor={`${errorId}-input`}>
          Add {meta.label.toLowerCase()} ({meta.unit})
        </label>
        <input
          id={`${errorId}-input`}
          ref={inputRef}
          className={`${styles.input}${error ? ` ${styles.invalid}` : ""}`}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={7}
          placeholder="0"
          value={draft}
          aria-describedby={error ? errorId : undefined}
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
          aria-label={`Add ${meta.label.toLowerCase()}`}
        >
          +
        </button>
      </form>

      <p className={styles.error} id={errorId}>
        {error}
      </p>
    </section>
  );
}

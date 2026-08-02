"use client";

import { useId, useState } from "react";
import { MACRO_IDS, MACRO_LIST, normaliseTarget, type MacroId } from "@/lib/macros";
import type { Targets } from "@/lib/schema";
import styles from "./TargetsForm.module.css";

const TINTS: Record<MacroId, string> = {
  calories: "var(--calories)",
  protein: "var(--protein)",
  fibre: "var(--fibre)",
};

const HINTS: Record<MacroId, string> = {
  calories: "Daily energy target",
  protein: "Daily protein target",
  fibre: "Daily fibre target",
};

type Draft = Record<MacroId, string>;

function toDraft(targets: Targets | null): Draft {
  return {
    calories: targets ? String(targets.calories) : "",
    protein: targets ? String(targets.protein) : "",
    fibre: targets ? String(targets.fibre) : "",
  };
}

interface Props {
  readonly initial: Targets | null;
  readonly submitLabel: string;
  readonly onSubmit: (targets: Targets) => void;
}

/**
 * Targets are always entered by the user — the app ships no defaults and makes
 * no recommendation, because it has no idea who is using it.
 */
export function TargetsForm({ initial, submitLabel, onSubmit }: Props) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(initial));
  const [error, setError] = useState("");
  const [touched, setTouched] = useState(false);
  const baseId = useId();

  const parsed = MACRO_IDS.map((id) => normaliseTarget(draft[id].trim().replace(",", "."), id));
  const complete = parsed.every((value) => value !== null);

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    setTouched(true);
    const invalid = MACRO_IDS.find((id, i) => parsed[i] === null);
    if (invalid) {
      setError(`Enter a ${invalid} target between 1 and ${MACRO_LIST[
        MACRO_IDS.indexOf(invalid)
      ]?.max.toLocaleString()}.`);
      return;
    }
    setError("");
    onSubmit({
      calories: parsed[0] as number,
      protein: parsed[1] as number,
      fibre: parsed[2] as number,
    });
  };

  return (
    <form className={styles.form} onSubmit={submit} noValidate>
      {MACRO_LIST.map((meta, i) => {
        const invalid = touched && parsed[i] === null;
        return (
          <div key={meta.id} className={styles.field} style={{ ["--tint" as string]: TINTS[meta.id] }}>
            <span className={styles.swatch} aria-hidden="true" />
            <label className={styles.text} htmlFor={`${baseId}-${meta.id}`}>
              <span className={styles.name}>{meta.label}</span>
              <span className={styles.hint}>{HINTS[meta.id]}</span>
            </label>
            <input
              id={`${baseId}-${meta.id}`}
              className={`${styles.input}${invalid ? ` ${styles.invalid}` : ""}`}
              type="text"
              inputMode="decimal"
              enterKeyHint="next"
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              maxLength={7}
              placeholder="0"
              value={draft[meta.id]}
              aria-invalid={invalid || undefined}
              onChange={(e) => {
                setDraft((prev) => ({ ...prev, [meta.id]: e.target.value }));
                if (error) setError("");
              }}
            />
            <span className={styles.unit} aria-hidden="true">
              {meta.unit}
            </span>
          </div>
        );
      })}

      <p className={styles.error} role="alert">
        {error}
      </p>

      <button type="submit" className={styles.submit} disabled={!complete}>
        {submitLabel}
      </button>
    </form>
  );
}

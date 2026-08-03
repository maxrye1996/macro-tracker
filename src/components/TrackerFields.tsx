"use client";

import { useId, useState } from "react";
import {
  colourVar,
  COLOUR_IDS,
  NAME_MAX,
  UNIT_MAX,
  type ColourId,
} from "@/lib/trackers";
import styles from "./TrackerFields.module.css";

export interface TrackerDraftValues {
  readonly name: string;
  readonly unit: string;
  readonly target: string;
  readonly colour: ColourId;
}

interface Props {
  readonly value: TrackerDraftValues;
  readonly onChange: (patch: Partial<TrackerDraftValues>) => void;
  /**
   * Called when a field loses focus, so edits persist without a Save button.
   * The colour buttons pass an override because React state has not yet
   * updated when the click handler runs.
   */
  readonly onCommit?: (override?: Partial<TrackerDraftValues>) => void;
  readonly onRemove?: () => void;
  readonly removeLabel?: string;
  readonly onMove?: (delta: -1 | 1) => void;
  readonly canMoveUp?: boolean;
  readonly canMoveDown?: boolean;
  readonly error?: string | undefined;
  readonly hint?: string | undefined;
  readonly autoFocus?: boolean;
}

/**
 * One editable tracker: colour, name, target, unit. Fully controlled — the
 * parent decides whether edits are staged (first run) or written straight
 * through (settings).
 */
export function TrackerFields({
  value,
  onChange,
  onCommit,
  onRemove,
  removeLabel = "Remove tracker",
  onMove,
  canMoveUp = false,
  canMoveDown = false,
  error,
  hint,
  autoFocus = false,
}: Props) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const baseId = useId();
  const tint = colourVar(value.colour);

  return (
    <div className={styles.card} style={{ ["--tint" as string]: tint }}>
      <div className={styles.top}>
        <button
          type="button"
          className={styles.swatch}
          onClick={() => setPaletteOpen((open) => !open)}
          aria-expanded={paletteOpen}
          aria-label={`Colour: ${value.colour}. Change colour`}
        >
          <span className={styles.swatchDot} aria-hidden="true" />
        </button>

        <label className="visually-hidden" htmlFor={`${baseId}-name`}>
          Tracker name
        </label>
        <input
          id={`${baseId}-name`}
          className={`${styles.name}${error ? ` ${styles.invalid}` : ""}`}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={NAME_MAX}
          placeholder="Name"
          value={value.name}
          autoFocus={autoFocus}
          onChange={(e) => onChange({ name: e.target.value })}
          onBlur={() => onCommit?.()}
        />

        {onMove && (
          <>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => onMove(-1)}
              disabled={!canMoveUp}
              aria-label={`Move ${value.name || "tracker"} earlier`}
            >
              ↑
            </button>
            <button
              type="button"
              className={styles.iconButton}
              onClick={() => onMove(1)}
              disabled={!canMoveDown}
              aria-label={`Move ${value.name || "tracker"} later`}
            >
              ↓
            </button>
          </>
        )}

        {onRemove && (
          <button
            type="button"
            className={`${styles.iconButton} ${styles.removeButton}`}
            onClick={onRemove}
            aria-label={`${removeLabel}: ${value.name || "unnamed tracker"}`}
          >
            ×
          </button>
        )}
      </div>

      <div className={styles.bottom}>
        <label className="visually-hidden" htmlFor={`${baseId}-target`}>
          Daily target for {value.name || "this tracker"}
        </label>
        <input
          id={`${baseId}-target`}
          className={`${styles.number}${error ? ` ${styles.invalid}` : ""}`}
          type="text"
          inputMode="decimal"
          enterKeyHint="done"
          autoComplete="off"
          maxLength={9}
          placeholder="Target"
          value={value.target}
          onChange={(e) => onChange({ target: e.target.value })}
          onBlur={() => onCommit?.()}
        />

        <label className="visually-hidden" htmlFor={`${baseId}-unit`}>
          Unit for {value.name || "this tracker"}
        </label>
        <input
          id={`${baseId}-unit`}
          className={styles.unit}
          type="text"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          maxLength={UNIT_MAX}
          placeholder="Unit"
          value={value.unit}
          onChange={(e) => onChange({ unit: e.target.value })}
          onBlur={() => onCommit?.()}
        />
      </div>

      {paletteOpen && (
        <div className={styles.palette} role="group" aria-label="Tracker colour">
          {COLOUR_IDS.map((colour) => (
            <button
              key={colour}
              type="button"
              className={`${styles.colour}${
                colour === value.colour ? ` ${styles.colourSelected}` : ""
              }`}
              style={{ ["--swatch" as string]: colourVar(colour) }}
              aria-label={colour}
              aria-pressed={colour === value.colour}
              onClick={() => {
                onChange({ colour });
                setPaletteOpen(false);
                onCommit?.({ colour });
              }}
            >
              <span className={styles.colourDot} aria-hidden="true" />
            </button>
          ))}
        </div>
      )}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className={styles.hint}>{hint}</p>
      ) : null}
    </div>
  );
}

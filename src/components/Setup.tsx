"use client";

import { useMemo, useState } from "react";
import { createId } from "@/lib/schema";
import {
  COLOUR_IDS,
  colourVar,
  MAX_TRACKERS,
  normaliseAmount,
  sanitiseName,
  sanitiseUnit,
  SUGGESTIONS,
  VALUE_MAX,
  type ColourId,
  type Suggestion,
  type Tracker,
} from "@/lib/trackers";
import { Brand } from "./Brand";
import { TrackerFields, type TrackerDraftValues } from "./TrackerFields";
import styles from "./Setup.module.css";

interface Draft extends TrackerDraftValues {
  readonly key: string;
}

function nextColour(drafts: readonly Draft[]): ColourId {
  const used = new Set(drafts.map((d) => d.colour));
  return COLOUR_IDS.find((c) => !used.has(c)) ?? "blue";
}

/**
 * First run. The suggestions fill in a name and a unit only — every target is
 * still typed by the user, because the app has no idea what anyone's numbers
 * should be and is not going to guess.
 */
export function Setup({ onDone }: { readonly onDone: (trackers: readonly Tracker[]) => void }) {
  const [drafts, setDrafts] = useState<readonly Draft[]>([]);
  const [showErrors, setShowErrors] = useState(false);

  const takenNames = useMemo(
    () => new Set(drafts.map((d) => d.name.trim().toLowerCase())),
    [drafts],
  );
  const remaining = SUGGESTIONS.filter((s) => !takenNames.has(s.name.toLowerCase()));
  const atLimit = drafts.length >= MAX_TRACKERS;

  const addSuggestion = (suggestion: Suggestion) => {
    if (atLimit) return;
    setDrafts((prev) => [
      ...prev,
      {
        key: createId(),
        name: suggestion.name,
        unit: suggestion.unit,
        target: "",
        colour: prev.some((d) => d.colour === suggestion.colour)
          ? nextColour(prev)
          : suggestion.colour,
      },
    ]);
  };

  const addBlank = () => {
    if (atLimit) return;
    setDrafts((prev) => [
      ...prev,
      { key: createId(), name: "", unit: "", target: "", colour: nextColour(prev) },
    ]);
  };

  const errorFor = (draft: Draft): string | undefined => {
    if (!showErrors) return undefined;
    if (sanitiseName(draft.name) === "") return "Give this tracker a name.";
    if (normaliseAmount(draft.target) === null) {
      return `Set a daily target between 1 and ${VALUE_MAX.toLocaleString()}.`;
    }
    return undefined;
  };

  const allValid =
    drafts.length > 0 &&
    drafts.every((d) => sanitiseName(d.name) !== "" && normaliseAmount(d.target) !== null);

  const submit = () => {
    if (!allValid) {
      setShowErrors(true);
      return;
    }
    const trackers: Tracker[] = drafts.map((d) => ({
      id: createId(),
      name: sanitiseName(d.name),
      unit: sanitiseUnit(d.unit),
      target: normaliseAmount(d.target) as number,
      colour: d.colour,
      archived: false,
    }));
    onDone(trackers);
  };

  return (
    <main className={styles.screen}>
      <div>
        <h1 className={styles.brand}>
          <Brand size="lg" />
        </h1>
        <p className={styles.lede}>
          Track whatever you actually care about — calories, water, salt, a medication dose.
          Pick a starting point or add your own, then set your own daily targets.
        </p>
      </div>

      {remaining.length > 0 && !atLimit && (
        <section>
          <h2 className={styles.sectionTitle}>Suggestions</h2>
          <div className={styles.chips}>
            {remaining.map((suggestion) => (
              <button
                key={suggestion.name}
                type="button"
                className={styles.chip}
                style={{ ["--tint" as string]: colourVar(suggestion.colour) }}
                onClick={() => addSuggestion(suggestion)}
              >
                <span className={styles.chipDot} aria-hidden="true" />
                {suggestion.name}
                {suggestion.unit && <span className={styles.chipUnit}>{suggestion.unit}</span>}
              </button>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className={styles.sectionTitle}>
          Your trackers{drafts.length > 0 ? ` (${drafts.length})` : ""}
        </h2>
        <div className={styles.drafts}>
          {drafts.length === 0 && (
            <p className={styles.empty}>
              Nothing added yet. Tap a suggestion above, or add your own.
            </p>
          )}

          {drafts.map((draft, index) => (
            <TrackerFields
              key={draft.key}
              value={draft}
              autoFocus={draft.name === "" && index === drafts.length - 1}
              error={errorFor(draft)}
              hint={index === 0 ? "Name, daily target, and the unit it is measured in." : undefined}
              onChange={(patch) =>
                setDrafts((prev) =>
                  prev.map((d) => (d.key === draft.key ? { ...d, ...patch } : d)),
                )
              }
              onRemove={() =>
                setDrafts((prev) => prev.filter((d) => d.key !== draft.key))
              }
            />
          ))}

          {!atLimit && (
            <button type="button" className={styles.addOwn} onClick={addBlank}>
              + Add your own
            </button>
          )}
        </div>
      </section>

      <div className={styles.footer}>
        <button type="button" className={styles.submit} onClick={submit} disabled={!allValid}>
          Start tracking
        </button>

        <p className={styles.note}>
          Everything stays on this device. No account, no server, no analytics — which also means
          nobody can recover it for you. Export a backup from Settings before changing phone or
          clearing browser data. You can add, edit and reorder trackers at any time.
        </p>
      </div>
    </main>
  );
}

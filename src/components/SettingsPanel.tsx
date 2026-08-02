"use client";

import { useEffect, useRef, useState } from "react";
import { csvFilename } from "@/lib/csv";
import type { Settings, Targets } from "@/lib/schema";
import { buildExport, deleteEverything, importFromCsv, setTargets } from "@/lib/store";
import { TargetsForm } from "./TargetsForm";
import styles from "./SettingsPanel.module.css";

/** Refuse to read anything larger than a plausible backup into memory. */
const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

type Status = { readonly tone: "info" | "error"; readonly text: string } | null;

interface Props {
  readonly settings: Settings;
  readonly dayCount: number;
  readonly onClose: () => void;
}

export function SettingsPanel({ settings, dayCount, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>(null);
  const [csvText, setCsvText] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  // `showModal` gives a real focus trap, inert background and Escape-to-close
  // without shipping a modal library.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open) return;
    dialog.showModal();
  }, []);

  const saveTargets = (targets: Targets) => {
    setTargets(targets);
    setStatus({ tone: "info", text: "Targets updated." });
  };

  const exportCsv = () => {
    const csv = buildExport();
    if (!csv) {
      setStatus({ tone: "error", text: "Nothing to export yet." });
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
      // Revoke on the next tick; revoking synchronously cancels the download
      // in some webviews.
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
      setStatus({ tone: "error", text: "That file is too large to be a MacroTracro backup." });
      return;
    }

    const proceed = window.confirm(
      "Importing replaces all data currently on this device. Continue?",
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
    const { days, entries, skipped } = report.summary;
    setStatus({
      tone: "info",
      text: `Imported ${entries} entries across ${days} day${days === 1 ? "" : "s"}${
        skipped > 0 ? `, skipped ${skipped} unreadable row${skipped === 1 ? "" : "s"}` : ""
      }.`,
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
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close settings">
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
          <h3 className={styles.sectionTitle}>Daily targets</h3>
          <TargetsForm initial={settings.targets} submitLabel="Save targets" onSubmit={saveTargets} />
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
                  {confirmingDelete ? "This cannot be undone" : "Targets and every logged day"}
                </span>
              </span>
            </button>
          </div>
        </section>

        <p className={styles.footNote}>
          MacroTracro stores everything in this device&apos;s local storage. It has no account
          system, makes no network requests, and contains no analytics or tracking.
        </p>
      </div>
    </dialog>
  );
}

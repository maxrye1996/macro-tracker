"use client";

import type { Targets } from "@/lib/schema";
import { TargetsForm } from "./TargetsForm";
import styles from "./Setup.module.css";

/** First run. Nothing is tracked until the user has said what they are aiming for. */
export function Setup({ onDone }: { readonly onDone: (targets: Targets) => void }) {
  return (
    <main className={styles.screen}>
      <div>
        <h1 className={styles.brand}>
          MacroTracro<span className={styles.dot}>.</span>
        </h1>
        <p className={styles.lede}>
          Set your own daily targets. The app makes no recommendations and holds no food
          database — you already know your numbers.
        </p>
      </div>

      <TargetsForm initial={null} submitLabel="Start tracking" onSubmit={onDone} />

      <p className={styles.note}>
        Everything stays on this device. No account, no server, no analytics — which also means
        nobody can recover it for you. Export a backup from Settings before changing phone or
        clearing browser data. You can change these targets at any time.
      </p>
    </main>
  );
}

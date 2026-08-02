"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { msUntilNextLocalMidnight } from "@/lib/date";
import {
  getServerSnapshot,
  getSnapshot,
  hydrate,
  refreshToday,
  reloadFromStorage,
  setTargets,
  subscribe,
} from "@/lib/store";
import { Setup } from "./Setup";
import { SettingsPanel } from "./SettingsPanel";
import { Tracker } from "./Tracker";
import styles from "./App.module.css";

export function App() {
  const state = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Storage is read after mount, never during render, so the prerendered HTML
  // and the first client render always match.
  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    const scheduleRollover = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        refreshToday();
        scheduleRollover();
      }, msUntilNextLocalMidnight());
    };
    scheduleRollover();

    // A backgrounded phone suspends timers, so re-check the date whenever the
    // app comes back into view. This is what makes the day roll over reliably
    // in a packaged mobile app.
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      refreshToday();
      scheduleRollover();
    };

    // Another tab of the web build writing to storage.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== null && !event.key.startsWith("mt.v1.")) return;
      reloadFromStorage();
    };

    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    window.addEventListener("storage", onStorage);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  if (!state.hydrated) {
    return (
      <main className={styles.splash} aria-busy="true">
        MacroTracro
      </main>
    );
  }

  if (!state.settings) {
    return <Setup onDone={setTargets} />;
  }

  return (
    <>
      <Tracker
        state={state}
        settings={state.settings}
        onOpenSettings={() => setSettingsOpen(true)}
      />
      {settingsOpen && (
        <SettingsPanel
          settings={state.settings}
          dayCount={state.loggedDays.length}
          onClose={() => setSettingsOpen(false)}
        />
      )}
    </>
  );
}

/**
 * The appearance preference: follow the device ("system", the default) or
 * force one theme.
 *
 * Mechanics: a `data-theme` attribute on <html> that globals.css keys off.
 * "system" means no attribute, so the `prefers-color-scheme` media queries
 * behave exactly as they always have — an untouched install changes nothing.
 *
 * A tiny inline script in the page head applies the stored value before first
 * paint (see layout.tsx), so a forced theme never flashes the system one at
 * cold start. That script reads the same key this module writes.
 */

import { KEYS, readString, removeKey, writeString } from "./storage";

export type ThemePref = "system" | "light" | "dark";

/** Untrusted input (storage can be hand-edited) to a safe value. */
export function parseThemePref(value: unknown): ThemePref {
  return value === "light" || value === "dark" ? value : "system";
}

export function getThemePref(): ThemePref {
  return parseThemePref(readString(KEYS.theme));
}

export function applyThemePref(pref: ThemePref): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  if (pref === "system") delete root.dataset["theme"];
  else root.dataset["theme"] = pref;
}

export function setThemePref(pref: ThemePref): void {
  if (pref === "system") removeKey(KEYS.theme);
  else writeString(KEYS.theme, pref);
  applyThemePref(pref);
}

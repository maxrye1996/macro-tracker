/**
 * The only module in the app that touches a persistence API.
 *
 * Everything is namespaced under `mt.v2.` and split one key per day, so adding
 * an entry rewrites just that day rather than the whole history — the cost of a
 * tap stays constant as the log grows to years of data.
 *
 * Swapping in native storage later (Capacitor Preferences, so iOS cannot evict
 * the data) means reimplementing this file's read/write functions and nothing
 * else.
 */

const PREFIX = "mt.v2.";

/** Pre-tracker schema, read once at startup so existing logs are not lost. */
const LEGACY_PREFIX = "mt.v1.";

/** Every namespace the app has ever owned, for enumeration and wiping. */
const ALL_PREFIXES = [PREFIX, LEGACY_PREFIX] as const;

export const KEYS = {
  settings: `${PREFIX}settings`,
  index: `${PREFIX}index`,
  day: (date: string) => `${PREFIX}day.${date}`,
} as const;

export const LEGACY_KEYS = {
  settings: `${LEGACY_PREFIX}settings`,
  index: `${LEGACY_PREFIX}index`,
  day: (date: string) => `${LEGACY_PREFIX}day.${date}`,
  prefix: LEGACY_PREFIX,
} as const;

export function isDayStorageKey(key: string): boolean {
  return key.startsWith(`${PREFIX}day.`);
}

export function isOwnedKey(key: string): boolean {
  return ALL_PREFIXES.some((p) => key.startsWith(p));
}

/**
 * localStorage access throws rather than returning null in several real cases:
 * Safari private browsing, storage disabled by policy, and quota exhaustion.
 * A tracker that crashes on write is worse than one that quietly degrades, so
 * every call is guarded and failures are reported to the caller instead.
 */
function backend(): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    const store = window.localStorage;
    // Touching the object is not enough; Safari only throws on use.
    const probe = `${PREFIX}probe`;
    store.setItem(probe, "1");
    store.removeItem(probe);
    return store;
  } catch {
    return null;
  }
}

let cachedBackend: Storage | null | undefined;

function store(): Storage | null {
  if (cachedBackend === undefined) cachedBackend = backend();
  return cachedBackend;
}

export function storageAvailable(): boolean {
  return store() !== null;
}

/** Reads and JSON-parses a key. Returns null for missing *or* malformed data. */
export function readJson(key: string): unknown {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}

export function writeJson(key: string, value: unknown): boolean {
  const s = store();
  if (!s) return false;
  try {
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function removeKey(key: string): void {
  const s = store();
  if (!s) return;
  try {
    s.removeItem(key);
  } catch {
    /* nothing useful to do */
  }
}

/** Every key this app owns, current and legacy. */
export function ownedKeys(): string[] {
  const s = store();
  if (!s) return [];
  const keys: string[] = [];
  try {
    for (let i = 0; i < s.length; i += 1) {
      const key = s.key(i);
      if (key !== null && isOwnedKey(key)) keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
}

export function clearAll(): void {
  for (const key of ownedKeys()) removeKey(key);
}

export function clearLegacy(): void {
  for (const key of ownedKeys()) {
    if (key.startsWith(LEGACY_PREFIX)) removeKey(key);
  }
}

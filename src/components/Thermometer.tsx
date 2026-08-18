import type { TrackerDirection } from "@/lib/trackers";
import styles from "./Thermometer.module.css";

interface Props {
  readonly value: number;
  readonly target: number;
  readonly tint: string;
  readonly direction: TrackerDirection;
  readonly label: string;
}

/**
 * The fill height is driven by a CSS custom property so progress animates on
 * the compositor — no per-frame React work, and no layout thrash when three of
 * these update at once.
 */
export function Thermometer({ value, target, tint, direction, label }: Props) {
  const ratio = target > 0 ? value / target : 0;
  const percent = Math.max(0, Math.min(1, ratio)) * 100;
  // Only a *limit* being exceeded is a warning worth hatching. A goal filling
  // past its target is the good outcome, so it just reads as a full tube.
  const over = direction === "limit" && ratio > 1;
  const met = direction === "goal" && ratio >= 1;
  const displayPercent = Math.round(ratio * 100);

  return (
    <div
      className={`${styles.wrap}${over ? ` ${styles.over}` : ""}${met ? ` ${styles.met}` : ""}`}
      style={{ ["--pct" as string]: `${percent}%`, ["--tint" as string]: tint }}
      role="meter"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={target}
      aria-valuetext={`${value} of ${target}, ${displayPercent} percent`}
    >
      <div className={styles.tube}>
        <div className={styles.fill} />
        <div className={styles.ticks} aria-hidden="true">
          {[25, 50, 75].map((t) => (
            <span key={t} className={styles.tick} style={{ bottom: `${t}%` }} />
          ))}
        </div>
      </div>
      <div className={`${styles.bulb}${value === 0 ? ` ${styles.empty}` : ""}`} aria-hidden="true">
        {displayPercent > 999 ? "999+" : `${displayPercent}%`}
      </div>
    </div>
  );
}

import { fromDayKey, type DayKey } from "@/lib/date";
import { formatAmount, type TrackerDirection } from "@/lib/trackers";
import type { DailyTotal } from "@/lib/store";
import styles from "./HistoryChart.module.css";

interface Props {
  readonly points: readonly DailyTotal[];
  readonly target: number;
  readonly direction: TrackerDirection;
  readonly unit: string;
  readonly tint: string;
  readonly ariaLabel: string;
}

// A fixed internal coordinate system; the SVG scales to its container via CSS,
// so no measurement or resize handling is needed.
const W = 640;
const H = 320;
const PAD = { top: 18, right: 20, bottom: 40, left: 58 } as const;
const PLOT_L = PAD.left;
const PLOT_R = W - PAD.right;
const PLOT_T = PAD.top;
const PLOT_B = H - PAD.bottom;
const PLOT_W = PLOT_R - PLOT_L;
const PLOT_H = PLOT_B - PLOT_T;

/** Smallest "round" number at or above v, so the axis top isn't a ragged value. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(v));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * pow;
}

function dayNumber(key: DayKey): number {
  return Math.round(fromDayKey(key).getTime() / 86_400_000);
}

function shortDate(key: DayKey): string {
  return fromDayKey(key).toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * A single-series line chart drawn as inline SVG — no charting library, so
 * nothing to download and nothing that could phone home. Colours come from the
 * tracker's own tint and from theme-aware CSS variables, so it reads in light
 * and dark.
 */
export function HistoryChart({ points, target, direction, unit, tint, ariaLabel }: Props) {
  if (points.length === 0) {
    return (
      <p className={styles.empty}>
        Nothing logged for this tracker yet. Add entries on the daily view and they&apos;ll appear
        here.
      </p>
    );
  }

  const maxTotal = Math.max(...points.map((p) => p.total));
  const yMax = niceCeil(Math.max(maxTotal, target));
  const yTicks = [0, yMax / 2, yMax];

  const minDay = dayNumber(points[0]!.date);
  const maxDay = dayNumber(points[points.length - 1]!.date);
  const span = maxDay - minDay;

  const x = (key: DayKey): number =>
    span === 0 ? PLOT_L + PLOT_W / 2 : PLOT_L + ((dayNumber(key) - minDay) / span) * PLOT_W;
  const y = (value: number): number => PLOT_B - (value / yMax) * PLOT_H;

  const line = points.map((p) => `${x(p.date).toFixed(1)},${y(p.total).toFixed(1)}`).join(" ");
  const targetY = y(Math.min(target, yMax));

  // At most four date labels so the axis never crowds on a long history.
  const labelStep = Math.max(1, Math.ceil(points.length / 4));
  const xLabels = points.filter(
    (_, i) => i % labelStep === 0 || i === points.length - 1,
  );

  return (
    <svg
      className={styles.chart}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={ariaLabel}
      style={{ ["--tint" as string]: tint }}
    >
      {/* Horizontal gridlines + y-axis values */}
      {yTicks.map((t) => (
        <g key={t}>
          <line
            className={styles.grid}
            x1={PLOT_L}
            y1={y(t)}
            x2={PLOT_R}
            y2={y(t)}
          />
          <text className={styles.axisText} x={PLOT_L - 8} y={y(t)} textAnchor="end" dominantBaseline="middle">
            {formatAmount(t)}
          </text>
        </g>
      ))}

      {/* Target / limit reference line */}
      <line
        className={styles.target}
        x1={PLOT_L}
        y1={targetY}
        x2={PLOT_R}
        y2={targetY}
      />
      <text className={styles.targetLabel} x={PLOT_R} y={targetY - 6} textAnchor="end">
        {direction === "goal" ? "Goal" : "Limit"} {formatAmount(target)}
        {unit ? ` ${unit}` : ""}
      </text>

      {/* The series */}
      {points.length > 1 && <polyline className={styles.line} points={line} />}
      {points.map((p) => (
        <circle key={p.date} className={styles.dot} cx={x(p.date)} cy={y(p.total)} r={4} />
      ))}

      {/* Date axis */}
      {xLabels.map((p) => (
        <text
          key={p.date}
          className={styles.axisText}
          x={x(p.date)}
          y={PLOT_B + 22}
          textAnchor="middle"
        >
          {shortDate(p.date)}
        </text>
      ))}
    </svg>
  );
}

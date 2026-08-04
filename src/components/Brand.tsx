import styles from "./Brand.module.css";

/**
 * The TrackRyte lockup.
 *
 * The artwork's wordmark is black, and the app's default theme is dark, so the
 * logo sits on a white plate in both themes rather than inverting or swapping
 * assets. The plate is deliberate design, not a fallback.
 *
 * `alt` carries the name, so callers can drop this straight into a heading and
 * still get an accessible name — and screen readers announce "TrackRyte", not
 * a filename.
 */
export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    <span className={`${styles.plate} ${size === "lg" ? styles.lg : styles.sm}`}>
      {/* Plain <img>, not next/image: this is a static export with
          `images.unoptimized`, so next/image would ship extra JavaScript and
          optimise nothing. The intrinsic width/height reserve the box before
          the file loads, so the header never shifts. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/brand.png" alt="TrackRyte" width={614} height={96} className={styles.image} />
    </span>
  );
}

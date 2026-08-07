import styles from "./Brand.module.css";

/**
 * The TrackRyte wordmark.
 *
 * `alt` carries the name, so callers can drop this straight into a heading and
 * still get an accessible name — and screen readers announce "TrackRyte", not
 * a filename.
 */
export function Brand({ size = "sm" }: { size?: "sm" | "lg" }) {
  return (
    // Plain <img>, not next/image: this is a static export with
    // `images.unoptimized`, so next/image would ship extra JavaScript and
    // optimise nothing. The intrinsic width/height reserve the box before
    // the file loads, so the header never shifts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/brand.png"
      alt="TrackRyte"
      width={619}
      height={96}
      className={`${styles.image} ${size === "lg" ? styles.lg : styles.sm}`}
    />
  );
}

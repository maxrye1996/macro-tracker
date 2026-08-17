import { IS_MOBILE_BUILD } from "./target";

/**
 * Saving the CSV export on the packaged app.
 *
 * The web build hands a blob to the browser's download machinery, which works
 * in a real browser but does nothing inside the Android/iOS webview: there is
 * no download manager behind a `blob:` URL, and the anchor click fails silently
 * rather than throwing, so the caller's try/catch never sees a problem. On the
 * mobile build we instead write the CSV to a file and pass it to the native
 * share sheet, so the user can save it to Files, Drive, email, wherever.
 *
 * No network is involved: Filesystem and Share are local native bridges, not
 * HTTP, so this holds even under the app's `connect-src 'none'`. The plugins
 * are imported dynamically so the web bundle never pulls them in.
 *
 * Returns true when the native path handled it (including the user dismissing
 * the share sheet), false when it genuinely could not, so the caller can fall
 * back to showing the copyable text.
 */
export async function shareCsvNatively(csv: string, filename: string): Promise<boolean> {
  if (!IS_MOBILE_BUILD) return false;
  try {
    const [{ Filesystem, Directory, Encoding }, { Share }] = await Promise.all([
      import("@capacitor/filesystem"),
      import("@capacitor/share"),
    ]);
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: csv,
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({
      title: "TrackRyte backup",
      url: uri,
      dialogTitle: "Save or share your TrackRyte backup",
    });
    return true;
  } catch (err) {
    // Dismissing the share sheet rejects on Android; that is not a failure, so
    // don't drop the user into the text fallback for it.
    const message = String((err as { message?: unknown })?.message ?? err).toLowerCase();
    if (message.includes("cancel")) return true;
    return false;
  }
}

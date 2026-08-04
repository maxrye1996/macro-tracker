import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  // Permanent once the app is first submitted: the store listing, its reviews
  // and its installs are all keyed to this. Change it only before publishing.
  appId: "com.trackryte.app",
  appName: "TrackRyte",
  // The statically exported Next.js bundle.
  webDir: "out",
  server: {
    androidScheme: "https",
    iosScheme: "https",
    // No remote origin is ever loaded. The webview may not navigate off the
    // bundled assets, so a stray link cannot turn the app into a browser.
    allowNavigation: [],
  },
  android: {
    // Block the webview from loading anything over plain HTTP.
    allowMixedContent: false,
    webContentsDebuggingEnabled: false,
  },
  ios: {
    contentInset: "always",
    limitsNavigationsToAppBoundDomains: true,
  },
};

export default config;

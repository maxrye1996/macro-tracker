import type { NextConfig } from "next";

/**
 * Static export only. This is a deliberate security constraint, not just a
 * packaging choice: with `output: "export"` there is no server, no API route
 * and no middleware, so there is no code path that could ever send a user's
 * data anywhere. It is also what Capacitor loads to build the iOS/Android apps.
 */
const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // Emit `/index.html` rather than a bare `/` route, which is what the
  // Capacitor webview and any plain static host expect to find on disk.
  trailingSlash: true,
  images: { unoptimized: true },
  // Do not leak the framework version to anyone sniffing the web deployment.
  poweredByHeader: false,
};

export default nextConfig;

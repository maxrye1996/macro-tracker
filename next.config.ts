import type { NextConfig } from "next";

/**
 * Static export only. This is a deliberate security constraint, not just a
 * packaging choice: with `output: "export"` there is no server, no API route
 * and no middleware, so there is no code path that could ever send a user's
 * data anywhere. It is also what Capacitor loads to build the iOS/Android apps.
 */
const isMobileBuild = process.env.NEXT_PUBLIC_BUILD_TARGET === "mobile";

const nextConfig: NextConfig = {
  output: "export",
  reactStrictMode: true,
  // Emit `/index.html` rather than a bare `/` route, which is what the
  // Capacitor webview and any plain static host expect to find on disk.
  trailingSlash: true,
  images: { unoptimized: true },
  // Do not leak the framework version to anyone sniffing the web deployment.
  poweredByHeader: false,
  turbopack: {
    // Resolve the analytics package to a component that renders nothing when
    // building for Capacitor. A render guard alone is not enough: a static
    // import ships the module either way, and the installed app should not
    // contain beacon code at all. See `src/lib/analytics-stub.tsx`.
    resolveAlias: isMobileBuild
      ? { "@vercel/analytics/next": "./src/lib/analytics-stub.tsx" }
      : {},
  },
};

export default nextConfig;

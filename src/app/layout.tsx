import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import { buildCsp } from "@/lib/csp";
import { BUILD_TARGET, IS_MOBILE_BUILD } from "@/lib/target";
import "./globals.css";

export const metadata: Metadata = {
  title: "TrackRyte",
  description:
    "A private, offline daily tracker. You choose what to track. Your data never leaves your device.",
  applicationName: "TrackRyte",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "TrackRyte", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false, date: false, email: false, address: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  // Lets the layout paint under the notch and home indicator; the safe-area
  // insets in the page CSS keep content clear of them.
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0b0d10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta
          httpEquiv="Content-Security-Policy"
          content={buildCsp(
            process.env.NODE_ENV === "production" ? "production" : "development",
            BUILD_TARGET,
          )}
        />
        <meta name="referrer" content="no-referrer" />
        {/* Applies a forced theme before first paint so choosing Light on a
            dark-mode device never flashes dark at launch. This is the one
            sanctioned use of dangerouslySetInnerHTML in the codebase: the
            string below is a compile-time constant with no interpolation, so
            nothing user-controlled can reach it. It reads the same key
            lib/theme.ts owns. */}
        <script
          // eslint-disable-next-line react/no-danger
          dangerouslySetInnerHTML={{
            __html:
              'try{var t=localStorage.getItem("mt.v2.theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}',
          }}
        />
      </head>
      <body>
        {children}
        {/* Anonymous, cookieless page counts. In the mobile build this is both
            guarded here and aliased away in next.config.ts, so no beacon code
            reaches the installed app. */}
        {!IS_MOBILE_BUILD && <Analytics />}
      </body>
    </html>
  );
}

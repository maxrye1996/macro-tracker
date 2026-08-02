import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MacroTracro",
  description: "A private, offline macro tracker. Your data never leaves your device.",
  applicationName: "MacroTracro",
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: "MacroTracro", statusBarStyle: "black-translucent" },
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

/**
 * `connect-src 'none'` is the load-bearing line: it makes network requests
 * impossible at the browser level, so the "your data never leaves the device"
 * promise does not depend on nobody ever adding a `fetch` by accident. The
 * rest locks the document down to its own assets.
 *
 * `script-src` has to allow inline for Next's bootstrap (a static export cannot
 * use per-request nonces). That is acceptable here only because the app renders
 * no HTML it did not author — no `dangerouslySetInnerHTML`, no remote content.
 */
const CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "font-src 'self'",
  // Dev only: `next dev` drives hot reload over a websocket to localhost, which
  // a blanket 'none' would kill. Production keeps the hard guarantee.
  process.env.NODE_ENV === "production"
    ? "connect-src 'none'"
    : "connect-src 'self' ws://localhost:* http://localhost:*",
  "form-action 'none'",
  "frame-ancestors 'none'",
  "base-uri 'none'",
  "object-src 'none'",
  "manifest-src 'self'",
].join("; ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Security-Policy" content={CSP} />
        <meta name="referrer" content="no-referrer" />
      </head>
      <body>{children}</body>
    </html>
  );
}

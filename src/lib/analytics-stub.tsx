/**
 * What `@vercel/analytics/next` resolves to in the mobile build.
 *
 * The render guard in `layout.tsx` already stops the component mounting, but a
 * static import keeps a module in the bundle whether it renders or not — so
 * without this alias the installed app would still ship code whose only purpose
 * is to beacon a page view. `connect-src 'none'` would block the request, but
 * "the app contains no analytics" should be true of the binary, not just of its
 * runtime behaviour.
 *
 * `next.config.ts` swaps this in when NEXT_PUBLIC_BUILD_TARGET is "mobile".
 */

export function Analytics(): null {
  return null;
}

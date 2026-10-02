// Cloudflare Pages middleware: the old Crucible subdomain stays connected so shared links keep
// working, but every request is permanently redirected to the same path on the canonical domain.
const canonicalOrigin = 'https://patrickmannion.dev';
const legacyHosts = new Set(['thoughts.cruciblesoftware.co']);

export function legacyRedirect(requestUrl) {
  const url = new URL(requestUrl);
  if (!legacyHosts.has(url.hostname.toLowerCase())) return null;
  return `${canonicalOrigin}${url.pathname}${url.search}`;
}

export async function onRequest(context) {
  const target = legacyRedirect(context.request.url);
  return target ? Response.redirect(target, 301) : context.next();
}

export type CookieJar = Record<string, string>;

export function applySetCookies(
  jar: CookieJar,
  setCookieLines: readonly string[],
  now = Date.now(),
): CookieJar {
  const next = { ...jar };
  for (const line of setCookieLines) {
    const [pair = "", ...attrs] = line.split(";");
    const separator = pair.indexOf("=");
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const value = pair.slice(separator + 1).trim();
    if (value === "" || isExpired(attrs, now)) delete next[name];
    else next[name] = value;
  }
  return next;
}

function isExpired(attrs: readonly string[], now: number): boolean {
  for (const raw of attrs) {
    const attr = raw.trim();
    const maxAge = /^max-age=(-?\d+)$/i.exec(attr);
    if (maxAge) return Number(maxAge[1]) <= 0;
    const expires = /^expires=(.+)$/i.exec(attr);
    if (expires) {
      const expiresAt = Date.parse(expires[1] ?? "");
      if (!Number.isNaN(expiresAt) && expiresAt <= now) return true;
    }
  }
  return false;
}

export function cookieHeader(jar: CookieJar): string {
  return Object.entries(jar)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
}

export function devAuthBypassEnabled() {
  // Safety: never allow bypass in production.
  if (process.env.NODE_ENV === 'production') return false

  // Enable via debug flag (preferred) or legacy flag.
  // .env.local:
  //   DEBUG_LOCAL=1
  //   (optional) DEV_AUTH_BYPASS=1
  return process.env.DEBUG_LOCAL === '1' || process.env.DEV_AUTH_BYPASS === '1'
}

/**
 * Resolve session id for server-side auth.
 * - In normal mode: returns { sid: string|null, bypass: false }
 * - In dev-bypass mode: returns { sid: string, bypass: true } even if cookieSid is missing
 */
export function resolveSid(cookieSid) {
  const bypass = devAuthBypassEnabled()
  if (cookieSid) return { sid: cookieSid, bypass }
  if (bypass) return { sid: 'dev', bypass: true }
  return { sid: null, bypass: false }
}

/**
 * Validates and sanitizes redirect query parameters.
 * Accepts only safe, same-origin relative paths starting with a single '/'
 * Rejects protocol-relative URLs (//), backslashes, CRLF/control characters, and external URLs.
 */
export function getSafeRedirectUrl(target: unknown): string {
  if (typeof target !== "string" || !target) {
    return "/"
  }

  const trimmed = target.trim()

  // Must begin with a single slash, cannot start with // or /\ or contain backslashes
  if (!trimmed.startsWith("/") || trimmed.startsWith("//") || trimmed.startsWith("/\\") || trimmed.includes("\\")) {
    return "/"
  }

  // Reject CR, LF, null or control characters
  if (/[\r\n\t\0]/.test(trimmed)) {
    return "/"
  }

  // Reject URL encoded slashes or backslashes that might confuse browsers or parsers
  if (/%2f|%5c/i.test(trimmed)) {
    return "/"
  }

  try {
    const parsed = new URL(trimmed, "http://irm.internal")
    if (parsed.origin !== "http://irm.internal") {
      return "/"
    }
    if (parsed.protocol !== "http:" || parsed.hostname !== "irm.internal") {
      return "/"
    }
    return parsed.pathname + parsed.search + parsed.hash
  } catch {
    return "/"
  }
}

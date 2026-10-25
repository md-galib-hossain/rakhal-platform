/** Default when the response carries no usable `Content-Disposition`. */
export function fallbackReportFilename(reportId: string): string {
  return `report-${reportId.replace(/[^A-Za-z0-9._-]/g, "")}.pdf`;
}

/** Strip path separators and control characters so a hostile header can never name a path. */
function sanitize(name: string): string {
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, "").replace(/[\\/]/g, "_").trim();
  return cleaned.replace(/^\.+/, "");
}

/**
 * Filename from a `Content-Disposition` header. Supports RFC 5987 `filename*=UTF-8''…` (preferred) and the plain
 * quoted/unquoted `filename=`. Falls back to `fallback` when absent, empty or malformed.
 */
export function parseContentDispositionFilename(header: string | null | undefined, fallback: string): string {
  if (!header) return fallback;
  const star = /filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i.exec(header);
  if (star) {
    try {
      const decoded = sanitize(decodeURIComponent(star[2].trim()));
      if (decoded) return decoded;
    } catch {
      // malformed percent-encoding: fall through to the plain form
    }
  }
  const quoted = /filename\s*=\s*"((?:[^"\\]|\\.)*)"/i.exec(header);
  if (quoted) {
    const name = sanitize(quoted[1].replace(/\\(.)/g, "$1"));
    if (name) return name;
  }
  const bare = /filename\s*=\s*([^;"][^;]*)/i.exec(header);
  if (bare) {
    const name = sanitize(bare[1].trim());
    if (name) return name;
  }
  return fallback;
}

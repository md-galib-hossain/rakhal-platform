/** Delay before the temporary object URL is revoked (the browser needs the click's navigation to start first). */
export const OBJECT_URL_REVOKE_DELAY_MS = 1_000;

/**
 * Triggers a browser "save as" for `blob` without ever putting a token in a URL: a temporary same-document
 * object URL on a detached `<a download>`, revoked right after the click. Browser-only (no-op during SSR).
 */
export function saveBlobAsFile(blob: Blob, filename: string): void {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_REVOKE_DELAY_MS);
  }
}

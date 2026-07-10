/**
 * Reads claims from the backend's access JWT WITHOUT verifying the signature — the backend is
 * the only verifier that matters (it re-checks the signature on every request); this is purely
 * so the BFF can decide "is this token close to expiry" without an extra round trip. Never trust
 * this decode for authorization decisions.
 */
export interface AccessTokenClaims {
  sub: string; // user id
  sessionId: string;
  farmId: string;
  permissionsVersion: number;
  iat: number;
  exp: number;
}

export function decodeAccessToken(token: string): AccessTokenClaims | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = Buffer.from(payload, "base64url").toString("utf8");
    return JSON.parse(json) as AccessTokenClaims;
  } catch {
    return null;
  }
}

/** True when the token is missing, unparseable, or expires within `skewSeconds`. */
export function isAccessTokenExpiring(token: string | undefined | null, skewSeconds = 30): boolean {
  if (!token) return true;
  const claims = decodeAccessToken(token);
  if (!claims) return true;
  return claims.exp * 1000 - Date.now() < skewSeconds * 1000;
}

-- RD-043: age `failedLoginAttempts` over `AUTH_LOCKOUT_WINDOW_SECONDS` instead of accumulating
-- forever. Nullable, additive, fully reversible — no existing row needs a value (a null means "no
-- failure streak recorded yet", treated as "not expired" is moot since failedLoginAttempts is 0).

ALTER TABLE "User" ADD COLUMN "lastFailedLoginAt" TIMESTAMP(3);

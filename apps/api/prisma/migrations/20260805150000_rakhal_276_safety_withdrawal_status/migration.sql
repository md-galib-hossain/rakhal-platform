-- RAKHAL-276: fix the SafetyWithdrawal silent-auto-release bug.
--
-- Was: SafetyWithdrawalStatus = ACTIVE|COMPLETED, with the ACTIVE->COMPLETED
-- transition running as a side effect of GET /health/dashboard and
-- GET /health/cattle/:id/summary (a query mutating the DB). A withdrawal
-- past its `until` date with nobody having actually confirmed release would
-- silently stop counting as milk-withholding.
--
-- Now: ACTIVE|READY_FOR_RELEASE|RELEASED|CANCELLED. `RELEASED` (renamed from
-- `COMPLETED`) is reached only via the new, audited HealthService.
-- releaseWithdrawal(); ACTIVE->READY_FOR_RELEASE is the daily sweep cron's
-- job, never a read path's.
--
-- Purely additive: 3 new enum values, nothing dropped. The legacy
-- `COMPLETED` value stays in the Postgres type (Postgres can't cheaply drop
-- an enum value without a rename/recreate — out of scope for this ticket,
-- which is additive-only per its own acceptance criteria) but is no longer
-- referenced anywhere in application code from this point on.

ALTER TYPE "SafetyWithdrawalStatus" ADD VALUE 'READY_FOR_RELEASE';
ALTER TYPE "SafetyWithdrawalStatus" ADD VALUE 'RELEASED';
ALTER TYPE "SafetyWithdrawalStatus" ADD VALUE 'CANCELLED';

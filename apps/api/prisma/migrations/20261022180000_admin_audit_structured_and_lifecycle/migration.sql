-- P2-04 structured admin audit + P2-05 admin lifecycle. Additive, plus an append-only trigger.

-- AlterTable: admin lifecycle (P2-05)
ALTER TABLE "PlatformAdmin"
    ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "passwordChangedAt" TIMESTAMP(3);

-- AlterTable: structured audit (P2-04). adminId becomes nullable so a failed
-- login for an unknown email can still be recorded (attempted address in actorEmail).
ALTER TABLE "PlatformAdminAuditLog"
    ALTER COLUMN "adminId" DROP NOT NULL,
    ADD COLUMN "outcome" TEXT NOT NULL DEFAULT 'SUCCESS',
    ADD COLUMN "actorEmail" TEXT,
    ADD COLUMN "before" JSONB,
    ADD COLUMN "after" JSONB,
    ADD COLUMN "sessionId" TEXT,
    ADD COLUMN "requestId" TEXT,
    ADD COLUMN "userAgent" TEXT;

-- CreateIndex
CREATE INDEX "PlatformAdminAuditLog_sessionId_idx" ON "PlatformAdminAuditLog"("sessionId");

-- CreateIndex
CREATE INDEX "PlatformAdminAuditLog_createdAt_idx" ON "PlatformAdminAuditLog"("createdAt");

-- Immutability: the audit trail is append-only.
--   * UPDATE is always rejected.
--   * DELETE is rejected unless the surrounding transaction set
--     `rakhal.audit_purge = 'on'` (retention job / test teardown only):
--       SELECT set_config('rakhal.audit_purge', 'on', true);
CREATE OR REPLACE FUNCTION platform_admin_audit_log_guard() RETURNS trigger AS $$
BEGIN
    IF TG_OP = 'UPDATE' THEN
        RAISE EXCEPTION 'PlatformAdminAuditLog is append-only (UPDATE rejected)'
            USING ERRCODE = 'restrict_violation';
    END IF;
    IF TG_OP = 'DELETE' AND coalesce(current_setting('rakhal.audit_purge', true), '') <> 'on' THEN
        RAISE EXCEPTION 'PlatformAdminAuditLog is append-only (DELETE rejected outside a purge transaction)'
            USING ERRCODE = 'restrict_violation';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "PlatformAdminAuditLog_append_only"
    BEFORE UPDATE OR DELETE ON "PlatformAdminAuditLog"
    FOR EACH ROW EXECUTE FUNCTION platform_admin_audit_log_guard();

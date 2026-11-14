-- DOWN (documentation only; NEVER auto-run). Reverts RPT-07b.
-- The enum value GENERATION_FAILED cannot be removed without a type rebuild (ADD VALUE is irreversible);
-- first ensure no Report row uses it. The effectiveFrom fix is intentionally not reverted.
ALTER TABLE "Report" DROP COLUMN "requestHash";
ALTER TABLE "Report" DROP COLUMN "manualRetries";

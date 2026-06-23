-- RBAC: expand PermissionGroup enum (RAKHAL-019).
-- Recreates the enum with the full module catalogue. Safe: the Permission table
-- is empty at this point (catalogue is populated by prisma/seed.ts afterwards),
-- so the USING cast never executes against a non-matching legacy value.

-- AlterEnum
BEGIN;
CREATE TYPE "PermissionGroup_new" AS ENUM (
  'GENERAL', 'DASHBOARD', 'CATTLE', 'REPRODUCTION', 'MILK', 'FEED',
  'HEALTHCARE', 'CALF', 'INVENTORY', 'FINANCE', 'TASK', 'REPORTS',
  'SCOREBOARD', 'ACTIVITY', 'SETTINGS', 'NOTIFICATION', 'TEAM'
);
ALTER TABLE "Permission"
  ALTER COLUMN "group" TYPE "PermissionGroup_new"
  USING ("group"::text::"PermissionGroup_new");
ALTER TYPE "PermissionGroup" RENAME TO "PermissionGroup_old";
ALTER TYPE "PermissionGroup_new" RENAME TO "PermissionGroup";
DROP TYPE "PermissionGroup_old";
COMMIT;

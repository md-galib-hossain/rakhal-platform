-- Backfill: link legacy free-text dose units to a system Unit by symbol (case-insensitive).
UPDATE "HealthPlanStep" s SET "doseUnitId" = u."id"
FROM "Unit" u
WHERE s."doseUnitId" IS NULL AND s."doseUnit" IS NOT NULL
  AND u."farmId" IS NULL AND u."deletedAt" IS NULL
  AND LOWER(u."symbol") = LOWER(TRIM(s."doseUnit"));

UPDATE "HealthTask" t SET "doseUnitId" = u."id"
FROM "Unit" u
WHERE t."doseUnitId" IS NULL AND t."doseUnit" IS NOT NULL
  AND u."farmId" IS NULL AND u."deletedAt" IS NULL
  AND LOWER(u."symbol") = LOWER(TRIM(t."doseUnit"));

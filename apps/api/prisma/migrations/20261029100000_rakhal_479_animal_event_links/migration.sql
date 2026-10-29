-- AlterTable
ALTER TABLE "AbortionEvent" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "BodyConditionScore" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "BreedingEvent" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "CalfWeaningRecord" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "CalfWeightRecord" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "CalvingEvent" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "CattleDisposition" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "DryPeriod" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "HeatEvent" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "MortalityRecord" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "PregnancyDiagnosis" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "TreatmentLog" ADD COLUMN     "animalEventId" TEXT;

-- AlterTable
ALTER TABLE "WeightRecord" ADD COLUMN     "animalEventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "AbortionEvent_animalEventId_key" ON "AbortionEvent"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "BodyConditionScore_animalEventId_key" ON "BodyConditionScore"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "BreedingEvent_animalEventId_key" ON "BreedingEvent"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalfWeaningRecord_animalEventId_key" ON "CalfWeaningRecord"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalfWeightRecord_animalEventId_key" ON "CalfWeightRecord"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalvingEvent_animalEventId_key" ON "CalvingEvent"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CattleDisposition_animalEventId_key" ON "CattleDisposition"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "DryPeriod_animalEventId_key" ON "DryPeriod"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "HeatEvent_animalEventId_key" ON "HeatEvent"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "MortalityRecord_animalEventId_key" ON "MortalityRecord"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "PregnancyDiagnosis_animalEventId_key" ON "PregnancyDiagnosis"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "TreatmentLog_animalEventId_key" ON "TreatmentLog"("animalEventId");

-- CreateIndex
CREATE UNIQUE INDEX "WeightRecord_animalEventId_key" ON "WeightRecord"("animalEventId");


-- RAKHAL-479: keep one AnimalEvent header per detail row, in the same transaction as the detail write.
-- Args: type, cattleCol, dateCol, recorderCol, voidedAtCol, historicalCol, historicalValue.
-- RAKHAL-481 handlers may pre-set "animalEventId"; the INSERT trigger then does nothing.
CREATE OR REPLACE FUNCTION animal_event_sync() RETURNS trigger AS $fn$
DECLARE
  j jsonb;
  v_type text;
  v_event_at timestamp(3);
  v_voided timestamp(3);
  eid text;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."animalEventId" IS NOT NULL THEN
      DELETE FROM "AnimalEvent" WHERE id = OLD."animalEventId";
    END IF;
    RETURN OLD;
  END IF;

  j := to_jsonb(NEW);
  v_event_at := (j->>TG_ARGV[2])::timestamp(3);
  v_voided := CASE WHEN TG_ARGV[4] <> '' THEN (j->>TG_ARGV[4])::timestamp(3) ELSE NULL END;

  IF TG_OP = 'UPDATE' THEN
    IF NEW."animalEventId" IS NOT NULL THEN
      UPDATE "AnimalEvent"
         SET "eventAt" = v_event_at,
             status = CASE WHEN v_voided IS NULL THEN 'ACTIVE' ELSE 'VOIDED' END::"EventStatus",
             "voidedAt" = v_voided,
             "updatedAt" = now()
       WHERE id = NEW."animalEventId";
    END IF;
    RETURN NEW;
  END IF;

  -- INSERT (BEFORE)
  IF NEW."animalEventId" IS NULL THEN
    v_type := TG_ARGV[0];
    IF v_type = 'DISPOSITION' THEN
      v_type := CASE j->>'type' WHEN 'SALE' THEN 'SOLD' WHEN 'DEATH' THEN 'DIED' WHEN 'CULL' THEN 'CULLED' ELSE 'MOVE' END;
    END IF;
    eid := 'ae_' || replace(gen_random_uuid()::text, '-', '');
    INSERT INTO "AnimalEvent" (id, "farmId", "cattleId", type, "eventAt", provenance, status, "voidedAt", "recordedById", "createdAt", "updatedAt")
    SELECT eid, c."farmId", c.id, v_type::"AnimalEventType", v_event_at,
           (CASE WHEN TG_ARGV[5] <> '' AND j->>TG_ARGV[5] = TG_ARGV[6] THEN 'HISTORICAL' ELSE 'RECORDED' END)::"EventProvenance",
           (CASE WHEN v_voided IS NULL THEN 'ACTIVE' ELSE 'VOIDED' END)::"EventStatus",
           v_voided,
           COALESCE(NULLIF(j->>TG_ARGV[3], ''), 'system'),
           now(), now()
      FROM "Cattle" c WHERE c.id = j->>TG_ARGV[1];
    IF FOUND THEN
      NEW."animalEventId" := eid;
    END IF;
  END IF;
  RETURN NEW;
END;
$fn$ LANGUAGE plpgsql;

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "HeatEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('HEAT','cattleId','heatDateTime','','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "HeatEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('HEAT','cattleId','heatDateTime','','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "HeatEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('HEAT','cattleId','heatDateTime','','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "BreedingEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('BREEDING','cattleId','breedingDate','','voidedAt','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "BreedingEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('BREEDING','cattleId','breedingDate','','voidedAt','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "BreedingEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('BREEDING','cattleId','breedingDate','','voidedAt','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "PregnancyDiagnosis" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('PREG_CHECK','cattleId','diagnosisDate','','','diagnosisMethod','PURCHASE_INTAKE');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "PregnancyDiagnosis" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('PREG_CHECK','cattleId','diagnosisDate','','','diagnosisMethod','PURCHASE_INTAKE');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "PregnancyDiagnosis" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('PREG_CHECK','cattleId','diagnosisDate','','','diagnosisMethod','PURCHASE_INTAKE');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "CalvingEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('CALVING','cattleId','calvingDate','','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "CalvingEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('CALVING','cattleId','calvingDate','','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "CalvingEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('CALVING','cattleId','calvingDate','','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "AbortionEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('ABORTION','cattleId','abortionDate','','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "AbortionEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('ABORTION','cattleId','abortionDate','','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "AbortionEvent" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('ABORTION','cattleId','abortionDate','','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "DryPeriod" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DRY_OFF','cattleId','startDate','','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "DryPeriod" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DRY_OFF','cattleId','startDate','','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "DryPeriod" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DRY_OFF','cattleId','startDate','','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "WeightRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEIGHT','cattleId','recordedDate','recordedBy','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "WeightRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEIGHT','cattleId','recordedDate','recordedBy','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "WeightRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEIGHT','cattleId','recordedDate','recordedBy','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "CalfWeightRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEIGHT','calfId','measuredDate','recordedBy','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "CalfWeightRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEIGHT','calfId','measuredDate','recordedBy','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "CalfWeightRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEIGHT','calfId','measuredDate','recordedBy','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "BodyConditionScore" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('BCS','cattleId','recordedDate','recordedBy','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "BodyConditionScore" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('BCS','cattleId','recordedDate','recordedBy','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "BodyConditionScore" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('BCS','cattleId','recordedDate','recordedBy','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "TreatmentLog" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('TREATMENT','cattleId','administeredAt','administeredBy','voidedAt','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "TreatmentLog" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('TREATMENT','cattleId','administeredAt','administeredBy','voidedAt','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "TreatmentLog" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('TREATMENT','cattleId','administeredAt','administeredBy','voidedAt','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "CattleDisposition" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DISPOSITION','cattleId','date','createdById','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "CattleDisposition" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DISPOSITION','cattleId','date','createdById','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "CattleDisposition" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DISPOSITION','cattleId','date','createdById','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "MortalityRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DIED','cattleId','deathDate','recordedBy','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "MortalityRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DIED','cattleId','deathDate','recordedBy','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "MortalityRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('DIED','cattleId','deathDate','recordedBy','','','');

CREATE TRIGGER trg_animal_event_ins BEFORE INSERT ON "CalfWeaningRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEANING','calfId','weaningDate','','','','');
CREATE TRIGGER trg_animal_event_upd AFTER UPDATE ON "CalfWeaningRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEANING','calfId','weaningDate','','','','');
CREATE TRIGGER trg_animal_event_del AFTER DELETE ON "CalfWeaningRecord" FOR EACH ROW EXECUTE FUNCTION animal_event_sync('WEANING','calfId','weaningDate','','','','');

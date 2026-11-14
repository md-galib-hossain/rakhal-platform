-- RAKHAL-481 follow-up: the app inserts the AnimalEvent header first, inside the same transaction as the
-- detail write, and announces it with transaction-local settings. The INSERT trigger then adopts that
-- header (sets "animalEventId") instead of creating its own; without the settings (legacy routes,
-- RAKHAL-490 removes them) it behaves exactly as before.
CREATE OR REPLACE FUNCTION animal_event_sync() RETURNS trigger AS $fn$
DECLARE
  j jsonb;
  v_type text;
  v_event_at timestamp(3);
  v_voided timestamp(3);
  eid text;
  pending text;
  pending_type text;
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

    -- Header already inserted by the write API in this transaction: adopt it once.
    pending := current_setting('app.event_id', true);
    pending_type := current_setting('app.event_type', true);
    IF pending IS NOT NULL AND pending <> ''
       AND (pending_type = v_type
            OR (v_type = 'TREATMENT' AND pending_type IN ('VACCINATION', 'DEWORMING'))) THEN
      NEW."animalEventId" := pending;
      PERFORM set_config('app.event_id', '', true);
      RETURN NEW;
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

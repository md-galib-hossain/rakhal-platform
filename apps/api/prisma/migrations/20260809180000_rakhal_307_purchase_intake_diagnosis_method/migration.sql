-- RAKHAL-307: additive enum value for cattle-intake pregnancy declarations.
-- Hand-authored (mirrors RAKHAL-298/299's own precedent) — `prisma migrate
-- dev`/`--create-only` both refuse to run non-interactively in this repo.
ALTER TYPE "PregnancyDiagnosisMethod" ADD VALUE 'PURCHASE_INTAKE';

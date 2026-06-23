# Health Module API

## 1. Module Overview

The Health module manages healthcare workflows for farm cattle:

```txt
Cattle gets sick
create health case
apply health plan
generate health tasks
log treatment doses
record clinical updates
close as recovered or mortality
track milk/meat withdrawal safety
show cattle health history
```

The existing project uses `Farm` as the tenant boundary. This module keeps the
requested `farmId` field name, and that value must be the farm ID.

All routes require:

```txt
JwtAuthGuard
SessionGuard
```

## 2. Folder Structure

```txt
src/modules/health
  health.module.ts
  health_module_readme.md
  application/services/health.service.ts
  presentation/controllers/health.controller.ts
  presentation/controllers/cattle-health.controller.ts
  presentation/dto/common.dto.ts
  presentation/dto/create-health-case.dto.ts
  presentation/dto/update-health-case.dto.ts
  presentation/dto/health-plan.dto.ts
  presentation/dto/case-actions.dto.ts
  presentation/dto/health-query.dto.ts
```

Prisma files:

```txt
prisma/schemas/health/health.enums.prisma
prisma/schemas/health/health.prisma
prisma/migrations/20260613171608_health_module/migration.sql
```

## 3. Domain Schemas

### HealthCase

Central case record for sickness, injury, vaccination, deworming, preventive,
routine, breeding-related, or other health events.

Important fields:

```txt
farmId
cattleId
caseCode
diagnosis
diagnosisType
priority
status
shedId
shedName
reportedBy
assignedVet
startDate
expectedRecoveryDate
closedDate
closeReason
mortalityId
healthPlanId
currentStep
totalSteps
progressPercentage
symptoms
isSafetyWithholdingActive
milkWithdrawalUntil
meatWithdrawalUntil
isActive
```

### HealthPlan and HealthPlanStep

Reusable treatment/prevention protocol. Applying a plan to a case generates
`HealthTask` records from plan steps.

### HealthTask

Scheduled action generated from a plan or managed manually by task endpoints.
Tracks due date, completion, rescheduling, skipping, medicine dose, and route.

### TreatmentLog

Dose/treatment administration log. Can complete a related task and create a
withdrawal record.

### HealthUpdate

Clinical progress note: improving, worsening, or stable, plus symptoms,
temperature, appetite, appearance, and observation.

### MortalityRecord

Death record. Logging mortality closes the case and updates cattle status to
`DEAD` and `isActive=false`.

### SafetyWithdrawal

Milk/meat withdrawal safety window after treatment.

### DiseaseCatalog

Database support exists for system or farm custom disease catalog entries. HTTP
routes are not implemented yet.

## 4. Shared Pagination

List routes return:

```json
{
  "items": [],
  "meta": {
    "total": 0,
    "page": 1,
    "limit": 20,
    "totalPages": 0
  }
}
```

Common query fields:

```txt
farmId
cattleId
search
fromDate
toDate
page
limit
sortBy
sortOrder
```

`farmId` is required on most health list/dashboard routes.

## 5. API List

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health/dashboard` | Farm health dashboard metrics |
| GET | `/health/sick-bay` | Active sick/treatment cases |
| POST | `/health/cases` | Create health case |
| GET | `/health/cases/:id` | Full case details |
| PATCH | `/health/cases/:id` | Update case |
| POST | `/health/cases/:id/apply-plan` | Apply plan and generate tasks |
| POST | `/health/cases/:id/log-treatment` | Log dose/treatment |
| POST | `/health/cases/:id/health-update` | Add clinical progress |
| POST | `/health/cases/:id/close` | Close recovered or mortality |
| POST | `/health/cases/:id/mortality` | Log mortality directly |
| GET | `/health/plans` | List plans |
| POST | `/health/plans` | Create plan |
| GET | `/health/plans/:id` | Plan details |
| PATCH | `/health/plans/:id` | Update plan and steps |
| DELETE | `/health/plans/:id` | Soft archive plan |
| GET | `/health/tasks` | Task hub |
| GET | `/health/tasks/calendar` | Month task counts |
| POST | `/health/tasks/:id/complete` | Complete task |
| POST | `/health/tasks/:id/reschedule` | Reschedule task |
| POST | `/health/tasks/:id/skip` | Skip task |
| GET | `/cattle/:id/health-summary` | Cattle profile health summary |
| GET | `/health/safety-withdrawals` | List withdrawals |
| POST | `/health/safety-withdrawals/refresh` | Complete expired withdrawals |

## 6. Create Case

```http
POST /health/cases
```

```json
{
  "farmId": "farm_id",
  "cattleId": "cattle_id",
  "diagnosis": "Mastitis",
  "diagnosisType": "DISEASE",
  "priority": "HIGH",
  "shedId": "shed_id",
  "shedName": "Shed A",
  "reportedBy": "user_id",
  "assignedVet": "Dr. Rahman",
  "startDate": "2026-06-13T10:00:00.000Z",
  "expectedRecoveryDate": "2026-06-18T10:00:00.000Z",
  "symptoms": ["Swollen udder", "Reduced milk"],
  "notes": "Detected during morning milking"
}
```

Rules:

```txt
cattle must exist
cattle.farmId must equal farmId
shedId must belong to farmId
diagnosis and priority are required
duplicate active case for same cattle + diagnosis is blocked
startDate defaults to now
```

## 7. Apply Plan

```http
POST /health/cases/:id/apply-plan
```

```json
{
  "healthPlanId": "plan_id",
  "startDate": "2026-06-13T10:00:00.000Z"
}
```

Behavior:

```txt
validates plan belongs to same Farm
deletes pending tasks for the case
creates HealthTask records from plan steps
updates healthCase.healthPlanId
sets totalSteps, currentStep, progressPercentage
```

## 8. Log Treatment

```http
POST /health/cases/:id/log-treatment
```

```json
{
  "healthTaskId": "task_id",
  "medicineId": "medicine_id",
  "medicineName": "Antibiotic X",
  "doseAmount": 10,
  "doseUnit": "ml",
  "route": "IM",
  "administeredAt": "2026-06-13T11:00:00.000Z",
  "administeredBy": "user_id",
  "stockDeductionQuantity": 10,
  "batchNo": "B-001",
  "milkWithdrawalDays": 3,
  "meatWithdrawalDays": 7,
  "notes": "First dose"
}
```

Behavior:

```txt
creates TreatmentLog
marks related HealthTask COMPLETED
updates case progress
creates SafetyWithdrawal when withdrawal days are supplied
sets case withdrawal warning fields
```

Medicine stock deduction:

```txt
Inventory/medicine module is not present yet.
stockDeducted is stored as false.
deductMedicineStockIfAvailable is represented as a TODO integration point.
```

## 9. Health Update

```http
POST /health/cases/:id/health-update
```

```json
{
  "clinicalProgress": "IMPROVING",
  "symptoms": ["Swelling reduced"],
  "temperature": 38.5,
  "appetite": "NORMAL",
  "appearance": "BRIGHT",
  "observation": "Responding well",
  "recordedBy": "user_id"
}
```

Behavior:

```txt
creates HealthUpdate
updates HealthCase status:
  IMPROVING -> IMPROVING
  WORSENING -> WORSENING
  STABLE -> STABLE
```

## 10. Close Case

Recovered:

```http
POST /health/cases/:id/close
```

```json
{
  "outcome": "RECOVERED",
  "observation": "Recovered after full treatment"
}
```

Behavior:

```txt
status = RECOVERED
closedDate = now
isActive = false
history remains available
```

Mortality through close endpoint:

```json
{
  "outcome": "MORTALITY",
  "mortality": {
    "deathDate": "2026-06-14T06:00:00.000Z",
    "primaryCauseOfDeath": "Severe infection",
    "vetSignOff": "Dr. Rahman",
    "symptoms": ["High fever", "Weakness"],
    "postMortemPerformed": false,
    "disposalMethod": "Burial",
    "disposalCost": 1500,
    "disposalLocation": "Farm disposal area",
    "additionalNotes": "Finance loss hook TODO",
    "recordedBy": "user_id"
  }
}
```

## 11. Mortality Log

```http
POST /health/cases/:id/mortality
```

Uses the same mortality body as above without wrapping it in `mortality`.

Behavior:

```txt
creates MortalityRecord
sets HealthCase status MORTALITY
closes HealthCase
updates Cattle status DEAD
sets Cattle isActive=false
finance loss hook is TODO
```

## 12. Health Plans

Create plan:

```http
POST /health/plans
```

```json
{
  "farmId": "farm_id",
  "name": "5 Day Mastitis Treatment",
  "category": "TREATMENT",
  "planType": "MEDICAL",
  "description": "Mastitis treatment protocol",
  "diagnosis": "Mastitis",
  "cycleLengthDays": 5,
  "isTemplate": true,
  "steps": [
    {
      "dayNumber": 0,
      "title": "Dose 1",
      "actionType": "MEDICINE",
      "medicineId": "medicine_id",
      "medicineName": "Antibiotic X",
      "doseAmount": 10,
      "doseUnit": "ml",
      "route": "IM",
      "instruction": "Administer after milking",
      "estimatedTime": "08:00",
      "milkWithdrawalDays": 3,
      "meatWithdrawalDays": 7,
      "isRequired": true
    }
  ]
}
```

Routes:

```txt
GET /health/plans?farmId=farm_id&search=mastitis
GET /health/plans/:id
PATCH /health/plans/:id
DELETE /health/plans/:id
```

Delete is a soft archive:

```txt
isActive=false
```

Seed/default plans:

```txt
No seed runner exists for this module yet.
Suggested future seed data:
5 Day Mastitis Treatment
FMD Vaccination Protocol
Deworming Protocol
Hoof Rot Treatment
Ovsynch Breeding Cycle
```

## 13. Health Tasks

Task hub:

```http
GET /health/tasks?farmId=farm_id&status=PENDING&type=MEDICINE
```

Calendar:

```http
GET /health/tasks/calendar?farmId=farm_id&month=6&year=2026
```

Complete:

```http
POST /health/tasks/:id/complete
```

Reschedule:

```http
POST /health/tasks/:id/reschedule
```

```json
{
  "newDueDateTime": "2026-06-14T09:00:00.000Z",
  "reason": "Vet delayed"
}
```

Skip:

```http
POST /health/tasks/:id/skip
```

```json
{
  "reason": "Animal recovered"
}
```

## 14. Cattle Profile Health

```http
GET /cattle/:id/health-summary
```

Returns:

```txt
activeCases
ongoingTreatment
treatmentProgress
treatmentHistory
safetyWithdrawalWarning
activeWithdrawals
vaccinationHistory
dewormingHistory
mortalityStatus
```

## 15. Safety Withdrawal

List:

```http
GET /health/safety-withdrawals?farmId=farm_id&status=ACTIVE
```

Refresh:

```http
POST /health/safety-withdrawals/refresh?farmId=farm_id
```

Refresh marks expired active withdrawal records as `COMPLETED`.

Safety warning behavior:

```txt
HealthCase stores milkWithdrawalUntil and meatWithdrawalUntil.
Cattle health summary returns safetyWithdrawalWarning=true when active withdrawals exist.
```

## 16. Dashboard Metrics

```http
GET /health/dashboard?farmId=farm_id
```

Returns:

```txt
herdHealthScore
healthyAnimalCount
totalAnimalCount
sickBayCount
medicineExpense
safetyWithdrawalCount
morbidityTrend
diseaseBreakdown
shedWiseHealth
upcomingTasksCount
overdueTasksCount
```

MVP formula:

```txt
herdHealthScore = healthyAnimalCount / totalAnimalCount * 100
```

Current notes:

```txt
medicineExpense returns 0 until inventory/finance cost data exists.
morbidityTrend is grouped by health case start date.
sickBayCount excludes recovered, mortality, and closed cases.
```

## 17. Business Rules

```txt
Every health record is Farm scoped.
farmId must be a farm ID.
Never expose another farm's cattle or health data.
Health case creation blocks duplicate active cases for same cattle + diagnosis.
Applying a plan and generating tasks runs in a transaction.
Treatment logging, task completion, withdrawal creation, and progress update run in a transaction.
Mortality logging updates health case and cattle in a transaction.
Soft delete/archive is used for plans.
Case history remains available after closure.
```

## 18. Testing Checklist

```txt
Create health case
Prevent cross-Farm access
Apply health plan and generate tasks
Complete dose and update progress
Deduct medicine stock when inventory exists
Create withdrawal warning
Mark case improving/worsening/stable
Close as recovered
Log mortality and update cattle
Get cattle health summary
Get dashboard metrics
Get task hub calendar
Refresh expired withdrawal records
```

## 19. Future Improvements

```txt
Inventory medicine stock deduction
Medicine cost and health expense analytics
Disease catalog endpoints
Scheduled job for overdue tasks and withdrawal refresh
Vaccination/deworming dedicated history views
Staff/vet assignment relation when staff module exists
Finance loss entry on mortality
Default health plan seed runner
Dashboard formula using mortality rate, morbidity rate, recovery rate, vaccination coverage, and overdue penalty
```

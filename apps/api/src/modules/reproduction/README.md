# Reproduction API

The reproduction module tracks the reproductive lifecycle of female cattle while
keeping the core cattle profile clean.

It currently implements:

```txt
Reproduction summary
Heat events
Breeding events
Pregnancy diagnoses
Pregnancy records
Calving events
Calf births
Abortion events
Lactation records
```

Dry periods exist in the database schema for future workflows, but there is no
HTTP route for creating or ending dry periods yet.

All routes require:

```txt
JwtAuthGuard
SessionGuard
```

Reproduction rows do not store `farmId` directly. Farm access is resolved
through the related cattle record.

## Shared List Query

Most list endpoints accept:

```txt
farmId
cattleId
fromDate
toDate
page
limit
sortBy
sortOrder
```

At least one of these is required:

```txt
farmId
cattleId
```

Pagination defaults:

```txt
page=1
limit=20
sortOrder=desc
```

`limit` is capped at `100`.

List response shape:

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

Date filtering uses the date field for each route:

```txt
heat-events: heatDateTime
breeding-events: breedingDate
pregnancies: conceptionDate
calving-events: calvingDate
abortion-events: abortionDate
lactations: startDate
```

Example:

```http
GET /reproduction/breeding-events?farmId=farm_id&fromDate=2026-01-01&toDate=2026-12-31&page=1&limit=20
```

## Enums

```txt
ReproductionState (RAKHAL-271 v2 — pure breeding-cycle CORE state, no lactation
state, no time-bound alerts baked in):
NOT_ELIGIBLE
POSTPARTUM_WAITING
OPEN
BRED_AWAITING_CONFIRMATION
PREGNANT

ReproductionAlert (RAKHAL-271/272 — derived, not stored, multi-valued;
layered on top of ReproductionState, returned as `reproductionAlerts` on the
summary response; this ticket implements only the date-window ones):
HEAT_DETECTED          active HeatEvent within the farm's heat window
PREGNANCY_CHECK_DUE    past expectedPregnancyCheckDate, no diagnosis yet
CALVING_DUE            within the farm's close-up window, state=PREGNANT
OVERDUE_PREGNANCY_CHECK, REPEAT_BREEDER, LONG_DAYS_OPEN, CALVING_OVERDUE,
ABORTION_HISTORY, REPRODUCTIVE_HOLD — RAKHAL-272, not yet implemented

HeatDetectionMethod:
VISUAL
COLLAR_SENSOR
PEDOMETER
MANUAL

BreedingMethod:
AI
NATURAL
EMBRYO_TRANSFER

BreedingStatus:
PENDING_CHECK
PREGNANT
FAILED
ABORTED
CALVED

PregnancyDiagnosisResult:
PREGNANT
NOT_PREGNANT
SUSPECTED

PregnancyDiagnosisMethod:
ULTRASOUND
PALPATION
LAB

PregnancyStatus:
ACTIVE
CALVED
ABORTED
FAILED

CalvingEase:
NORMAL
ASSISTED
DIFFICULT
CESAREAN

CalfBirthStatus:
ALIVE
STILLBORN
DIED_AFTER_BIRTH

LactationStatus:
ACTIVE
ENDED
```

## Route Summary

```txt
GET  /cattle/:id/reproduction-summary

POST /reproduction/heat-events
GET  /reproduction/heat-events

POST /reproduction/breeding-events
GET  /reproduction/breeding-events
GET  /reproduction/breeding-events/:id

POST /reproduction/pregnancy-diagnoses
GET  /reproduction/pregnancies

POST /reproduction/calving-events
GET  /reproduction/calving-events

POST /reproduction/abortion-events
GET  /reproduction/abortion-events

GET  /reproduction/lactations
```

## GET /cattle/:id/reproduction-summary

Returns computed reproduction KPIs for one female cattle.

Example:

```http
GET /cattle/cattle_id/reproduction-summary
```

Response:

```json
{
  "cattle": {
    "id": "cattle_id",
    "tagNumber": "COW-101"
  },
  "status": "PREGNANT",
  "reproductionAlerts": ["CALVING_DUE"],
  "currentLactation": 3,
  "dim": 145,
  "totalCalvings": 4,
  "totalPregnancies": 5,
  "totalAbortions": 0,
  "conceptionRate": 0.72,
  "servicesPerConception": 1.4,
  "averageCalvingInterval": 385,
  "expectedCalvingDate": "2027-01-12T00:00:00.000Z",
  "daysPregnant": 165,
  "lastBreeding": "2026-07-02T00:00:00.000Z",
  "daysOpen": 90,
  "gestationLength": null
}
```

Computed fields:

```txt
dim = today - active lactation startDate
conceptionRate = successful pregnancies / breeding events
servicesPerConception = breeding events / successful pregnancies
averageCalvingInterval = average days between consecutive calvings
daysPregnant = today - active pregnancy conceptionDate
daysOpen = last calving to next successful conception
```

## POST /reproduction/heat-events

Creates a heat detection record.

Required fields:

```txt
cattleId
heatDateTime
detectionMethod
```

Optional fields:

```txt
standingHeat
mucusDischarge
mountingBehavior
restlessness
notes
```

Example:

```json
{
  "cattleId": "cattle_id",
  "heatDateTime": "2026-06-11T08:30:00.000Z",
  "detectionMethod": "VISUAL",
  "standingHeat": true,
  "mucusDischarge": true,
  "mountingBehavior": false,
  "restlessness": true,
  "notes": "Strong visual signs"
}
```

Side effects:

```txt
Creates reproduction profile if missing.
```

Rules:

```txt
cattleId must exist.
Cattle must be FEMALE.
User must have access to the cattle farm.
Boolean symptom fields default to false.
```

## GET /reproduction/heat-events

Lists heat events.

Supported `sortBy`:

```txt
heatDateTime
createdAt
```

Example:

```http
GET /reproduction/heat-events?farmId=farm_id&page=1&limit=20&sortBy=heatDateTime&sortOrder=desc
```

## POST /reproduction/breeding-events

Creates an AI, natural service, or embryo transfer record.

Required fields:

```txt
cattleId
breedingDate
breedingMethod
```

Optional fields:

```txt
bullId
semenBatchId
inseminator
breedingNumber
expectedPregnancyCheckDate
status
notes
```

Example:

```json
{
  "cattleId": "cattle_id",
  "breedingDate": "2026-06-11T00:00:00.000Z",
  "breedingMethod": "AI",
  "bullId": "bull_cattle_id",
  "semenBatchId": "SEMEN-2026-001",
  "inseminator": "Dr. Karim",
  "expectedPregnancyCheckDate": "2026-07-16T00:00:00.000Z",
  "notes": "First service"
}
```

Defaults:

```txt
breedingNumber = previous breeding count for the cattle + 1
expectedPregnancyCheckDate = breedingDate + 35 days
status = PENDING_CHECK
```

Rules:

```txt
cattleId must be FEMALE.
bullId, when supplied, must belong to the same farm.
```

Side effects:

```txt
Refreshes ReproductionProfile.
If this is the latest pending breeding, profile status becomes
BRED_AWAITING_CONFIRMATION (state does not change once
expectedPregnancyCheckDate passes — that surfaces as the
PREGNANCY_CHECK_DUE alert instead, RAKHAL-271 v2).
```

## GET /reproduction/breeding-events

Lists breeding events.

Supported `sortBy`:

```txt
breedingDate
createdAt
status
```

Response items include bull summary when `bullId` exists.

Example:

```http
GET /reproduction/breeding-events?farmId=farm_id&sortBy=breedingDate&sortOrder=desc
```

## GET /reproduction/breeding-events/:id

Returns one breeding event with:

```txt
cattle farm context
bull summary
pregnancy diagnoses
pregnancies
```

Throws `404` if the event does not exist.

## POST /reproduction/pregnancy-diagnoses

Creates a pregnancy diagnosis record.

Required fields:

```txt
cattleId
diagnosisDate
result
diagnosisMethod
```

Optional fields:

```txt
breedingEventId
gestationDay
expectedCalvingDate
notes
```

Example:

```json
{
  "cattleId": "cattle_id",
  "breedingEventId": "breeding_event_id",
  "diagnosisDate": "2026-07-16T00:00:00.000Z",
  "result": "PREGNANT",
  "diagnosisMethod": "ULTRASOUND",
  "gestationDay": 35,
  "expectedCalvingDate": "2027-03-18T00:00:00.000Z",
  "notes": "Confirmed by ultrasound"
}
```

Rules:

```txt
cattleId must be FEMALE.
breedingEventId, when supplied, must belong to the same cattle.
```

Side effects:

```txt
If result=PREGNANT:
  creates an ACTIVE Pregnancy
  sets related BreedingEvent status to PREGNANT
  updates ReproductionProfile currentPregnancyId and status

If result=NOT_PREGNANT and breedingEventId is supplied:
  sets related BreedingEvent status to FAILED
```

Pregnancy defaults:

```txt
conceptionDate = breedingEvent.breedingDate when breedingEventId exists
conceptionDate = diagnosisDate when no breedingEventId exists
expectedCalvingDate = supplied expectedCalvingDate or conceptionDate + 280 days
status = ACTIVE
```

## GET /reproduction/pregnancies

Lists pregnancy records.

Supported `sortBy`:

```txt
conceptionDate
createdAt
status
```

Example:

```http
GET /reproduction/pregnancies?cattleId=cattle_id&sortBy=conceptionDate&sortOrder=desc
```

## POST /reproduction/calving-events

Creates a calving event and starts a lactation.

Required fields:

```txt
cattleId
calvingDate
calvingEase
```

Optional fields:

```txt
pregnancyId
calvingNumber
calfCount
placentaExpelled
retainedPlacenta
complications
notes
calves
```

Example:

```json
{
  "cattleId": "cattle_id",
  "pregnancyId": "pregnancy_id",
  "calvingDate": "2027-03-18T00:00:00.000Z",
  "calvingEase": "NORMAL",
  "calfCount": 1,
  "placentaExpelled": true,
  "retainedPlacenta": false,
  "calves": [
    {
      "tagNumber": "CALF-001",
      "name": "Calf 001",
      "gender": "FEMALE",
      "birthWeight": 28,
      "status": "ALIVE"
    }
  ],
  "notes": "Healthy calving"
}
```

Calf item fields:

```txt
gender required
status required
tagNumber required only when status=ALIVE
name optional
birthWeight optional
```

Defaults:

```txt
calvingNumber = previous calving count for the cattle + 1
calfCount = calves.length when calves exists, otherwise 1
placentaExpelled = false
retainedPlacenta = false
```

Side effects:

```txt
Creates CalvingEvent.
Creates ACTIVE Lactation with startDate=calvingDate,
  startReason=CALVING, sourceCalvingEventId=the new CalvingEvent's id.
Flips Cattle.productionStatus to MILKING (Cattle.lactationStartDate does not
  exist — RAKHAL-269/271 v2 correction; Lactation is the sole source of truth).
If pregnancyId is supplied:
  marks Pregnancy as CALVED
  sets actualCalvingDate
  calculates gestationDays
  marks related BreedingEvent as CALVED
For each ALIVE calf:
  creates a core Cattle record
  sets motherId to the calving cattle
  sets fatherId from the pregnancy breeding event bull, when available
  creates CalfBirth linked to the calf cattle
Refreshes ReproductionProfile.
```

## GET /reproduction/calving-events

Lists calving events.

Supported `sortBy`:

```txt
calvingDate
createdAt
```

Response items include:

```txt
calfBirths
lactations
```

Example:

```http
GET /reproduction/calving-events?farmId=farm_id&sortBy=calvingDate&sortOrder=desc
```

## POST /reproduction/abortion-events

Creates an abortion event.

Required fields:

```txt
cattleId
abortionDate
```

Optional fields:

```txt
pregnancyId
gestationDay
suspectedCause
notes
```

Example:

```json
{
  "cattleId": "cattle_id",
  "pregnancyId": "pregnancy_id",
  "abortionDate": "2026-09-10T00:00:00.000Z",
  "gestationDay": 90,
  "suspectedCause": "Unknown",
  "notes": "Vet follow-up required"
}
```

Rules:

```txt
pregnancyId, when supplied, must belong to the same cattle.
```

Side effects:

```txt
Creates AbortionEvent.
If pregnancyId is supplied:
  marks Pregnancy as ABORTED
  marks related BreedingEvent as ABORTED
Clears ReproductionProfile.currentPregnancyId, then refreshes — the cow
returns to a derived status (typically OPEN), no dead-end ABORTED status.
```

## GET /reproduction/abortion-events

Lists abortion events.

Supported `sortBy`:

```txt
abortionDate
createdAt
```

Example:

```http
GET /reproduction/abortion-events?farmId=farm_id&sortBy=abortionDate&sortOrder=desc
```

## GET /reproduction/lactations

Lists lactation records. Lactations are created from calving events.

Supported `sortBy`:

```txt
startDate
createdAt
status
```

Response items include:

```txt
calvingEvent
```

Example:

```http
GET /reproduction/lactations?cattleId=cattle_id&sortBy=startDate&sortOrder=desc
```

DIM is computed by consumers or summary/profile APIs as:

```txt
today - lactation.startDate
```

## Reproduction Profile Refresh

The service refreshes `ReproductionProfile` after major events.

Stored counters and snapshots:

```txt
currentLactationNumber
totalBreedings
totalPregnancies
totalCalvings
totalAbortions
firstCalvingDate
lastBreedingDate
lastPregnancyCheckDate
lastCalvingDate
currentPregnancyId
currentLactationId
```

Core-state priority during refresh (first match wins; RAKHAL-271 v2):

```txt
NOT_ELIGIBLE               male, or female below breeding age with no breeding history
PREGNANT                   any active pregnancy exists, regardless of closeness
                            to calving (closeness is the CALVING_DUE alert, not a
                            different state — v1's EXPECTED_TO_CALVE is gone)
BRED_AWAITING_CONFIRMATION latest breeding is PENDING_CHECK (renamed from v1's
                            INSEMINATED; staying past expectedPregnancyCheckDate
                            surfaces as the PREGNANCY_CHECK_DUE alert, not a
                            different state — v1's PREGNANCY_CHECK_DUE is gone)
POSTPARTUM_WAITING         inside the farm's VWP window after the last calving
OPEN                       otherwise
```

`ReproductionAlert[]` (RAKHAL-271/272) is derived separately, at read time,
never stored — see `deriveReproductionAlerts`
(`src/modules/reproduction/domain/reproduction-alerts.ts`). v1's `IN_HEAT`
became the `HEAT_DETECTED` alert.

Lactation state (DRY/MILKING) lives on `Cattle.productionStatus`, not here —
`refreshProfile()` no longer mixes it into `ReproductionState`.

## Error Behavior

The module uses NestJS exceptions:

```txt
400 BadRequestException
404 NotFoundException
403 ForbiddenException from farm access checks
401 UnauthorizedException from auth/session guard
```

Common bad requests:

```txt
Creating reproduction records for non-FEMALE cattle.
Supplying a bull from another farm.
Supplying breedingEventId for another cattle.
Supplying pregnancyId for another cattle.
Listing without farmId or cattleId.
Creating an ALIVE calf without tagNumber.
```

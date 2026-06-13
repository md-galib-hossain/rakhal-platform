# Core Cattle API

The cattle module owns the MVP animal profile and its lookup tables:

```txt
Cattle
Breed
Shed
```

It intentionally does not store health, milk, feed, finance, weight, or
reproduction history inside the core cattle record. Those are separate modules.

All routes require:

```txt
JwtAuthGuard
SessionGuard
```

Farm authorization is resolved in the service layer. Create/list routes receive
`farmId` in the request body or query string. Item routes resolve the farm from
the stored record.

## Shared Pagination

List endpoints return:

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

Common query parameters:

```txt
page=1
limit=20
sortBy=createdAt
sortOrder=desc
includeArchived=false
```

`limit` is capped at `100`. `sortOrder` supports `asc` and `desc`.

## Enums

```txt
CattleGender:
MALE
FEMALE
CASTRATED_MALE

CattlePurpose:
MILK
BREEDING
MEAT
CALF
BULL_SERVICE
DUAL_PURPOSE

CattleStatus:
ACTIVE
SOLD
DEAD
TRANSFERRED
MISSING
ARCHIVED

CattleSourceType:
BORN
PURCHASED
GIFTED
UNKNOWN
```

## Cattle Routes

```txt
POST   /cattle
GET    /cattle
GET    /cattle/:id
PATCH  /cattle/:id
PATCH  /cattle/:id/archive
PATCH  /cattle/:id/restore
DELETE /cattle/:id
GET    /cattle/:id/profile
GET    /cattle/:id/ancestry?depth=3
GET    /cattle/:id/children
GET    /cattle/:id/siblings
```

### POST /cattle

Creates a cattle profile.

Required fields:

```txt
farmId
tagNumber
gender
purpose
```

Optional fields:

```txt
name
image
breedId
dateOfBirth
status
shedId
motherId
fatherId
sourceType
color
notes
```

Example:

```json
{
  "farmId": "farm_id",
  "tagNumber": "COW-101",
  "name": "Cow 101",
  "image": "https://example.com/cow-101.jpg",
  "breedId": "breed_id",
  "gender": "FEMALE",
  "dateOfBirth": "2023-02-10",
  "purpose": "MILK",
  "status": "ACTIVE",
  "shedId": "shed_id",
  "motherId": "mother_cattle_id",
  "fatherId": "father_cattle_id",
  "sourceType": "BORN",
  "color": "Black and white",
  "notes": "Good milk line"
}
```

Rules:

```txt
tagNumber must be unique per farm.
breedId must belong to the same farm.
shedId must belong to the same farm.
motherId and fatherId must belong to the same farm.
A cattle cannot be its own parent.
Circular ancestry is blocked.
sourceType defaults to UNKNOWN.
status defaults to ACTIVE.
isActive is false only when status is ARCHIVED.
```

### GET /cattle

Lists cattle for a farm.

Query parameters:

```txt
farmId          required
search          optional, matches name, tagNumber, color
breedId         optional
gender          optional
purpose         optional
status          optional
shedId          optional
page            optional, default 1
limit           optional, default 20
sortBy          optional
sortOrder       optional, default desc
includeArchived optional, default false
```

Supported `sortBy`:

```txt
tagNumber
name
dateOfBirth
createdAt
updatedAt
status
```

Example:

```http
GET /cattle?farmId=farm_id&search=COW&gender=FEMALE&purpose=MILK&page=1&limit=20&sortBy=tagNumber&sortOrder=asc
```

Archived cattle are excluded unless:

```http
GET /cattle?farmId=farm_id&includeArchived=true
```

### GET /cattle/:id

Returns one cattle record with:

```txt
breed
shed
mother summary
father summary
```

Throws `404` if the cattle does not exist.

### PATCH /cattle/:id

Updates a cattle profile. The body accepts the same fields as `POST /cattle`,
but all are optional.

Important:

```txt
farmId cannot be changed.
tagNumber uniqueness is still enforced per farm.
breedId, shedId, motherId, and fatherId are revalidated when supplied.
status=ARCHIVED also sets isActive=false.
```

Example:

```json
{
  "name": "Cow 101 Updated",
  "shedId": "new_shed_id",
  "notes": "Moved to Shed B"
}
```

### PATCH /cattle/:id/archive

Soft archives a cattle record:

```txt
status = ARCHIVED
isActive = false
```

### PATCH /cattle/:id/restore

Restores an archived cattle record:

```txt
status = ACTIVE
isActive = true
```

### DELETE /cattle/:id

Soft delete. Internally this calls archive and returns the archived cattle.

### GET /cattle/:id/profile

Returns cattle details plus derived fields.

Included data:

```txt
basic cattle profile
breed
shed
mother summary
father summary
childrenCount
age
dim
pregnancyStatus
healthStatus
```

Derived field behavior:

```txt
age is calculated from dateOfBirth.
dim comes from the active reproduction lactation, if one exists.
pregnancyStatus comes from the active reproduction pregnancy, if one exists.
healthStatus is currently NOT_RECORDED.
```

### GET /cattle/:id/ancestry?depth=3

Builds a recursive parent tree from `motherId` and `fatherId`.

Query:

```txt
depth optional, default 3, min 1, max 6
```

Example response:

```json
{
  "id": "cattle_id",
  "name": "Cow 101",
  "tagNumber": "COW-101",
  "mother": {
    "id": "mother_id",
    "name": "Mother Cow",
    "tagNumber": "COW-050",
    "mother": null,
    "father": null
  },
  "father": {
    "id": "father_id",
    "name": "Father Bull",
    "tagNumber": "BULL-010",
    "mother": null,
    "father": null
  }
}
```

### GET /cattle/:id/children

Returns active cattle where:

```txt
motherId = :id
or
fatherId = :id
```

Response items include:

```txt
id
name
tagNumber
```

### GET /cattle/:id/siblings

Returns active cattle from the same farm that share the same mother or father.
The current cattle is excluded.

## Breed Routes

```txt
POST   /breeds
GET    /breeds
GET    /breeds/:id
PATCH  /breeds/:id
PATCH  /breeds/:id/archive
PATCH  /breeds/:id/restore
DELETE /breeds/:id
```

### POST /breeds

Creates a farm-scoped breed.

Required fields:

```txt
farmId
name
```

Optional fields:

```txt
description
```

Example:

```json
{
  "farmId": "farm_id",
  "name": "Holstein Friesian",
  "description": "High milk yielding dairy breed"
}
```

Rules:

```txt
Breed name is unique per farm.
isActive defaults to true.
```

### GET /breeds

Query parameters:

```txt
farmId required
search optional, matches name
page optional
limit optional
sortBy optional
sortOrder optional
includeArchived optional
```

Supported `sortBy`:

```txt
name
createdAt
updatedAt
```

Example:

```http
GET /breeds?farmId=farm_id&search=Holstein&page=1&limit=20&sortBy=name&sortOrder=asc
```

### GET /breeds/:id

Returns one breed after farm access validation.

### PATCH /breeds/:id

Updates `name` and/or `description`.

Important:

```txt
farmId cannot be changed.
Name uniqueness per farm is enforced.
```

### PATCH /breeds/:id/archive

Sets:

```txt
isActive = false
```

### PATCH /breeds/:id/restore

Sets:

```txt
isActive = true
```

### DELETE /breeds/:id

Soft delete. Internally this archives the breed.

## Shed Routes

```txt
POST   /sheds
GET    /sheds
GET    /sheds/:id
PATCH  /sheds/:id
PATCH  /sheds/:id/archive
PATCH  /sheds/:id/restore
DELETE /sheds/:id
```

### POST /sheds

Creates a farm-scoped shed/location.

Required fields:

```txt
farmId
name
code
```

Optional fields:

```txt
description
capacity
```

Example:

```json
{
  "farmId": "farm_id",
  "name": "Shed A",
  "code": "SHED-A",
  "description": "Main adult cattle shed",
  "capacity": 40
}
```

Rules:

```txt
Shed code is unique per farm.
capacity must be 0 or greater when supplied.
isActive defaults to true.
```

### GET /sheds

Query parameters:

```txt
farmId required
search optional, matches name or code
page optional
limit optional
sortBy optional
sortOrder optional
includeArchived optional
```

Supported `sortBy`:

```txt
name
code
capacity
createdAt
updatedAt
```

Example:

```http
GET /sheds?farmId=farm_id&search=SHED&page=1&limit=20&sortBy=code&sortOrder=asc
```

### GET /sheds/:id

Returns one shed after farm access validation.

### PATCH /sheds/:id

Updates:

```txt
name
code
description
capacity
```

Important:

```txt
farmId cannot be changed.
Code uniqueness per farm is enforced.
```

### PATCH /sheds/:id/archive

Sets:

```txt
isActive = false
```

### PATCH /sheds/:id/restore

Sets:

```txt
isActive = true
```

### DELETE /sheds/:id

Soft delete. Internally this archives the shed.

## Error Behavior

The module uses NestJS exceptions:

```txt
400 BadRequestException
404 NotFoundException
409 ConflictException
403 ForbiddenException from farm access checks
401 UnauthorizedException from auth/session guard
```

Common conflicts:

```txt
Duplicate cattle tag number per farm.
Duplicate breed name per farm.
Duplicate shed code per farm.
```

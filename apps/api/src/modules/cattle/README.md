# Core Cattle API

All endpoints require an authenticated session. `farmId` is supplied in request
body for create operations and in query string for list operations. Item routes
resolve farm access from the stored record.

## Cattle

```http
POST /cattle
{
  "farmId": "farm_id",
  "tagNumber": "COW-101",
  "name": "Cow 101",
  "gender": "FEMALE",
  "purpose": "MILK",
  "sourceType": "BORN",
  "breedId": "breed_id",
  "shedId": "shed_id",
  "motherId": "mother_cattle_id",
  "fatherId": "father_cattle_id",
  "color": "Black and white",
  "notes": "Good milk line"
}
```

```http
GET /cattle?farmId=farm_id&search=COW&breedId=breed_id&gender=FEMALE&page=1&limit=20&sortBy=tagNumber&sortOrder=asc
GET /cattle/:id
PATCH /cattle/:id
PATCH /cattle/:id/archive
PATCH /cattle/:id/restore
DELETE /cattle/:id
GET /cattle/:id/profile
GET /cattle/:id/ancestry?depth=3
GET /cattle/:id/children
GET /cattle/:id/siblings
```

Normal cattle lists exclude archived cattle unless `includeArchived=true`.
`DELETE /cattle/:id` is a soft delete that archives the cattle.

## Breeds

```http
POST /breeds
{
  "farmId": "farm_id",
  "name": "Holstein Friesian",
  "description": "High milk yielding dairy breed"
}

GET /breeds?farmId=farm_id&page=1&limit=20
GET /breeds/:id
PATCH /breeds/:id
PATCH /breeds/:id/archive
PATCH /breeds/:id/restore
DELETE /breeds/:id
```

Breed names are unique per farm. Delete is implemented as archive.

## Sheds

```http
POST /sheds
{
  "farmId": "farm_id",
  "name": "Shed A",
  "code": "SHED-A",
  "description": "Main adult cattle shed",
  "capacity": 40
}

GET /sheds?farmId=farm_id&page=1&limit=20
GET /sheds/:id
PATCH /sheds/:id
PATCH /sheds/:id/archive
PATCH /sheds/:id/restore
DELETE /sheds/:id
```

Shed codes are unique per farm. Delete is implemented as archive.

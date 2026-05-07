# Samha CRM - API Reference

Base URL: `http://localhost:3000`

## Health Check

### Check API Status

```
GET /health
```

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

---

## Projects

### List All Projects

```
GET /api/projects
```

**Response:**
```json
[
  {
    "id": "clu1234567890",
    "name": "Samha Tower",
    "location": "Dubai Marina",
    "totalUnits": 173,
    "handoverDate": "2026-12-31T00:00:00.000Z",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z",
    "_count": {
      "units": 173
    }
  }
]
```

### Get Project with Units

```
GET /api/projects/:id
```

**Parameters:**
- `id` (string): Project ID

**Response:**
```json
{
  "id": "clu1234567890",
  "name": "Samha Tower",
  "location": "Dubai Marina",
  "totalUnits": 173,
  "handoverDate": "2026-12-31T00:00:00.000Z",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "units": [
    {
      "id": "unit123",
      "unitNumber": "1-01",
      "floor": 1,
      "type": "STUDIO",
      "area": 450,
      "price": 650000,
      "view": "SEA",
      "status": "AVAILABLE"
    }
  ]
}
```

---

## Units

### List Units with Filters

```
GET /api/projects/:projectId/units?status=AVAILABLE&type=ONE_BR&floor=5
```

**Parameters:**
- `projectId` (string): Project ID
- `status` (string, optional): AVAILABLE|INTERESTED|RESERVED|BOOKED|SOLD|BLOCKED|HANDED_OVER
- `type` (string, optional): STUDIO|ONE_BR|TWO_BR|THREE_BR|COMMERCIAL
- `floor` (number, optional): Floor number

**Response:**
```json
[
  {
    "id": "unit123",
    "projectId": "clu1234567890",
    "unitNumber": "1-01",
    "floor": 1,
    "type": "STUDIO",
    "area": 450,
    "price": 650000,
    "view": "SEA",
    "status": "AVAILABLE",
    "interestedBuyerId": null,
    "bookedById": null,
    "soldToId": null,
    "reservedById": null,
    "assignedAgentId": "user123",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

### Get Unit Details

```
GET /api/units/:id
```

**Parameters:**
- `id` (string): Unit ID

**Response:**
```json
{
  "id": "unit123",
  "projectId": "clu1234567890",
  "unitNumber": "1-01",
  "floor": 1,
  "type": "STUDIO",
  "area": 450,
  "price": 650000,
  "view": "SEA",
  "status": "AVAILABLE",
  "interestedBuyerId": null,
  "bookedById": null,
  "soldToId": null,
  "reservedById": null,
  "assignedAgentId": "user123",
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2024-01-15T10:00:00.000Z",
  "statusHistory": [
    {
      "id": "hist123",
      "unitId": "unit123",
      "oldStatus": "AVAILABLE",
      "newStatus": "INTERESTED",
      "changedBy": "sara@samha.ae",
      "reason": "Customer inquiry",
      "changedAt": "2024-01-15T09:00:00.000Z"
    }
  ],
  "assignedAgent": {
    "id": "user123",
    "email": "sara@samha.ae",
    "name": "Sara Sales",
    "role": "SALES_AGENT"
  }
}
```

### Update Unit Status

```
PATCH /api/units/:id/status
```

**Parameters:**
- `id` (string): Unit ID

**Request Body:**
```json
{
  "newStatus": "INTERESTED",
  "reason": "Customer inquiry received"
}
```

**Response:**
```json
{
  "id": "unit123",
  "projectId": "clu1234567890",
  "unitNumber": "1-01",
  "floor": 1,
  "type": "STUDIO",
  "area": 450,
  "price": 650000,
  "view": "SEA",
  "status": "INTERESTED",
  "updatedAt": "2024-01-15T10:30:00.000Z"
}
```

---

## Statistics

### Get Project Statistics

```
GET /api/projects/:projectId/stats
```

**Parameters:**
- `projectId` (string): Project ID

**Response:**
```json
{
  "total": 173,
  "byStatus": {
    "AVAILABLE": 104,
    "SOLD": 31,
    "RESERVED": 17,
    "BOOKED": 12,
    "BLOCKED": 9,
    "INTERESTED": 0,
    "HANDED_OVER": 0
  }
}
```

---

## Users

### List All Users

```
GET /api/users
```

**Response:**
```json
[
  {
    "id": "user123",
    "email": "sara@samha.ae",
    "name": "Sara Sales",
    "role": "SALES_AGENT",
    "phone": "+971501234567",
    "department": "Sales",
    "createdAt": "2024-01-15T10:00:00.000Z",
    "updatedAt": "2024-01-15T10:00:00.000Z"
  }
]
```

---

## Enums Reference

### UnitStatus

```
AVAILABLE    - Unit is available for purchase
INTERESTED   - Customer has shown interest
RESERVED     - Unit is reserved by customer
BOOKED       - Unit is booked (with agreement)
SOLD         - Unit is sold
BLOCKED      - Unit is blocked (maintenance, hold, etc.)
HANDED_OVER  - Unit has been handed over
```

### UnitType

```
STUDIO       - Studio apartment
ONE_BR       - 1 Bedroom
TWO_BR       - 2 Bedrooms
THREE_BR     - 3 Bedrooms
COMMERCIAL   - Commercial unit
```

### ViewType

```
SEA          - Sea view
GARDEN       - Garden view
CITY         - City view
POOL         - Pool view
INTERNAL     - Internal view
```

### UserRole

```
ADMIN        - Administrator
SALES_AGENT  - Sales agent/staff
OPERATIONS   - Operations team
FINANCE      - Finance team
DEVELOPER    - Developer/system user
```

---

## Error Responses

### 404 Not Found

```json
{
  "error": "Project not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Failed to fetch projects"
}
```

---

## Usage Examples

### Get all available units on floor 5

```bash
curl "http://localhost:3000/api/projects/PROJECT_ID/units?floor=5&status=AVAILABLE"
```

### Get 2-bedroom units

```bash
curl "http://localhost:3000/api/projects/PROJECT_ID/units?type=TWO_BR"
```

### Update unit status with reason

```bash
curl -X PATCH "http://localhost:3000/api/units/UNIT_ID/status" \
  -H "Content-Type: application/json" \
  -d '{
    "newStatus": "BOOKED",
    "reason": "Sales agreement signed"
  }'
```

### Get project statistics

```bash
curl "http://localhost:3000/api/projects/PROJECT_ID/stats"
```

---

## Rate Limiting

Currently no rate limiting. Will be added in production deployment.

## Authentication

All `/api/*` routes (except `/api/auth/login`, `/api/auth/refresh`, `/api/auth/forgot-password`, `/api/auth/reset-password`) require a JWT bearer token.

```
Authorization: Bearer <accessToken>
```

The access token is obtained from `POST /api/auth/login` and is short-lived (15 min by default). When it expires, call `POST /api/auth/refresh` (the httpOnly refresh cookie is sent automatically) to get a new one.

---

## Support

For API issues:
1. Check `/health` endpoint is responding
2. Verify DATABASE_URL in `.env`
3. Ensure PostgreSQL is running
4. Check backend logs for error details

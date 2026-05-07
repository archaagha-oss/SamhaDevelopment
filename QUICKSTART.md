# Samha CRM - Quick Start (5 Minutes)

## Prerequisites

```bash
# Check Node.js is installed (v18+)
node --version
npm --version

# PostgreSQL running (local or Docker)
```

## Step 1: Install Dependencies (2 min)

```bash
cd samha-crm
npm install
```

## Step 2: Configure Environment (1 min)

Copy example files:
```bash
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env
```

**Option A: Use Docker (Recommended)**

```bash
docker-compose up -d
# Database URL in apps/api/.env:
DATABASE_URL="postgresql://samha_user:samha_password@localhost:5432/samha_crm"
```

**Option B: Existing PostgreSQL**

Edit `apps/api/.env`:
```env
DATABASE_URL="mysql://user:password@localhost:3306/samha_crm"
JWT_SECRET="$(openssl rand -base64 64)"
SEED_DEFAULT_PASSWORD="ChangeMe123!"
```

## Step 3: Database (1 min)

```bash
npm run db:push    # Create schema
npm run db:seed    # Load 173 units
```

## Step 4: Run (1 min)

```bash
npm run dev
```

Open: **http://localhost:5173**

---

## What You'll See

✅ **Samha Tower** project selector
✅ **173 units** in floor × unit grid (20 floors)
✅ **Status colors**: Green (Available), Red (Sold), Yellow (Reserved), etc.
✅ **Click units** to see details
✅ **Filters**: By status, type, floor
✅ **Statistics**: Total, Available, Sold, Reserved counts

---

## Common Commands

```bash
# Start dev (both frontend + backend)
npm run dev

# Backend only
npm run dev --workspace=apps/api

# Frontend only
npm run dev --workspace=apps/web

# Database
npm run db:push      # Update schema
npm run db:seed      # Reload sample data

# Build for production
npm run build
```

---

## Verify It Works

1. ✅ Backend health: http://localhost:3000/health
2. ✅ Frontend loads: http://localhost:5173
3. ✅ Project visible: "Samha Tower" in dropdown
4. ✅ Unit grid shows: 173 colored units
5. ✅ Click a unit: Detail modal appears

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `ECONNREFUSED 127.0.0.1:3306` | Start MySQL or Docker |
| `DATABASE_URL is missing` | Copy `.env.example` and fill it |
| `JWT_SECRET is required` | Set `JWT_SECRET` in `apps/api/.env` |
| Port 3000/5173 in use | Change in `.env` or close app |
| npm install fails | `rm -rf node_modules && npm install` |

---

## File Locations

- **Backend**: `apps/api/src/index.ts`
- **Frontend**: `apps/web/src/App.tsx`
- **Database**: `apps/api/prisma/schema.prisma`
- **Types**: `apps/web/src/types/index.ts`
- **Seed Data**: `apps/api/src/db/seed.ts`

---

## API Endpoints (for testing)

```bash
# Get projects
curl http://localhost:3000/api/projects

# Get units
curl http://localhost:3000/api/projects/PROJECT_ID/units

# Get stats
curl http://localhost:3000/api/projects/PROJECT_ID/stats

# Health check
curl http://localhost:3000/health
```

---

## Full Documentation

- **README.md** - Complete guide
- **SETUP.md** - Detailed setup
- **API.md** - All endpoints
- **INITIALIZE-SUMMARY.md** - What was created
- **EXECUTION-CHECKLIST.md** - Phase 1 requirements

---

**🚀 Ready to go!** Run `npm run dev` and start exploring.

Any issues? Check **SETUP.md** for troubleshooting.

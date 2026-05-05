# Samha CRM - Setup Guide

## Prerequisites Checklist

- [ ] Node.js v18+ installed
- [ ] PostgreSQL running locally or access to remote PostgreSQL
- [ ] Clerk account created (clerk.com)
- [ ] Text editor or IDE (VS Code recommended)

## Step-by-Step Setup

### Step 1: Create PostgreSQL Database

```bash
# Using psql
createdb samha_crm

# Or via GUI tool (pgAdmin, DBeaver, etc.)
```

### Step 2: Clone/Navigate to Project

```bash
cd samha-crm
```

### Step 3: Install Dependencies

```bash
npm install
```

### Step 4: Configure Environment Variables

**Backend** - Create `apps/api/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/samha_crm"
CLERK_SECRET_KEY="sk_test_xxxxxxxxxxxxx"
NODE_ENV="development"
PORT=3000
```

**Frontend** - Create `apps/web/.env`:

```env
VITE_CLERK_PUBLISHABLE_KEY="pk_test_xxxxxxxxxxxxx"
```

> Get these keys from your Clerk dashboard at https://dashboard.clerk.com

### Step 5: Initialize Database

```bash
npm run db:push
```

✅ Tables are now created in PostgreSQL

### Step 6: Seed Sample Data

```bash
npm run db:seed
```

✅ Creates Samha Tower project with 173 units and 5 sample users

### Step 7: Start Development

```bash
npm run dev
```

This will start:
- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:5173

Open http://localhost:5173 in your browser.

## Verification Checklist

- [ ] Backend responds to `curl http://localhost:3000/health`
- [ ] Frontend loads without errors at http://localhost:5173
- [ ] Project selector shows "Samha Tower"
- [ ] Unit grid displays floor layout
- [ ] Status summary shows totals (should be 173 units)
- [ ] Can click units to view details

## Common Issues & Fixes

### PostgreSQL Connection Error

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Fix**: Make sure PostgreSQL is running

```bash
# On Windows (if installed as service)
net start postgresql-x64-15

# Or start PostgreSQL app

# On Mac
brew services start postgresql
```

### Port Already in Use

```
Error: listen EADDRINUSE :::3000
```

**Fix**: Change port in `apps/api/.env`

```env
PORT=3001
```

### Clerk Keys Not Working

```
Error: Clerk: VITE_CLERK_PUBLISHABLE_KEY is missing
```

**Fix**: 
1. Go to https://dashboard.clerk.com
2. Copy your Publishable Key to `apps/web/.env`
3. Copy your Secret Key to `apps/api/.env`

### npm install Fails

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

## What's Included

### Backend (`apps/api`)
- ✅ Express server with 10+ API endpoints
- ✅ Prisma ORM with PostgreSQL
- ✅ Clerk authentication integration
- ✅ Unit grid data endpoints
- ✅ Project and statistics APIs
- ✅ Seed script with realistic data

### Frontend (`apps/web`)
- ✅ React 18 with Vite
- ✅ Tailwind CSS styling
- ✅ Unit grid dashboard (floor × unit matrix)
- ✅ Color-coded status visualization
- ✅ Filter bar (status, type, floor)
- ✅ Summary cards and statistics
- ✅ Unit detail modal
- ✅ Status legend

### Database
- ✅ 14 models (Project, Unit, User, etc.)
- ✅ Enum-based status types
- ✅ Relationships and constraints
- ✅ Indexes for performance
- ✅ Status history audit trail

## Next: Explore the App

1. **View Samha Tower**: Select from project dropdown
2. **Explore Unit Grid**: See 173 units across 20 floors
3. **Use Filters**: Filter by status, type, or floor
4. **Click Units**: View detailed unit information
5. **Check Statistics**: See availability breakdown

## Project URLs

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3000
- **API Health**: http://localhost:3000/health
- **Clerk Dashboard**: https://dashboard.clerk.com

## Important Files

- `apps/api/prisma/schema.prisma` - Database schema
- `apps/api/src/index.ts` - Backend server
- `apps/api/src/db/seed.ts` - Sample data generation
- `apps/web/src/components/ProjectDashboard.tsx` - Main UI component
- `apps/web/src/components/UnitGrid.tsx` - Grid visualization

## Database Inspection

Connect to PostgreSQL to inspect data:

```bash
psql samha_crm

# List tables
\dt

# View units
SELECT id, "unitNumber", floor, type, price, status FROM "Unit" LIMIT 10;

# View project
SELECT * FROM "Project";

# View users
SELECT id, email, name, role FROM "User";
```

## Documentation

- **README.md** - Full documentation
- **SETUP.md** - This file
- **apps/api/prisma/schema.prisma** - Database schema
- **Specification documents** (01-09) - Complete business logic

## Support

If you encounter issues:

1. Check the **Troubleshooting** section in README.md
2. Verify all prerequisites are installed
3. Ensure environment variables are correct
4. Check backend logs at http://localhost:3000/health
5. Open browser DevTools (F12) for frontend errors

---

🎉 **You're ready to go!** Start with `npm run dev`

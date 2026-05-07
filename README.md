# Samha CRM - Real Estate Sales Pipeline Management

A full-stack web application for managing real estate sales pipelines with unit inventory tracking, status management, and sales team coordination.

## 📋 Project Structure

```
samha-crm/
├── apps/
│   ├── api/          # Backend: Node.js + Express + TypeScript
│   └── web/          # Frontend: React + Vite + TypeScript
├── package.json      # Monorepo workspace config
└── README.md
```

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express
- **TypeScript** for type safety
- **Prisma** ORM with MySQL
- **Email + password** auth (bcrypt + JWT, httpOnly refresh cookie)

### Frontend
- **React 18** with Vite bundler
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Axios** for API calls
- Custom `AuthProvider` with automatic token refresh

## 📦 Prerequisites

- **Node.js** v18+ and npm/yarn/pnpm
- **MySQL** v8+ / MariaDB v10.5+ (local or remote)

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd samha-crm
npm install
```

### 2. Set Up Environment Variables

**Backend** (`apps/api/.env`):
```env
DATABASE_URL="mysql://user:password@localhost:3306/samha_crm"
NODE_ENV="development"
PORT=3000
JWT_SECRET="$(openssl rand -base64 64)"
PASSWORD_RESET_URL_BASE="http://localhost:5173/reset-password"
SEED_DEFAULT_PASSWORD="ChangeMe123!"
```

The frontend talks to the API through Vite's dev proxy and does not need its own `.env`.

### 3. Set Up Database

```bash
npm run db:push
```

This will create all tables in MySQL based on the Prisma schema.

### 4. Seed Sample Data

```bash
npm run db:seed
```

This creates:
- **1 project**: Samha Tower (Dubai Marina, 173 units, Dec 2026 handover)
- **173 units** with realistic mix of types and prices
- **5 users** with different roles (Admin, Sales, Operations, Finance)

### 5. Start Development Servers

```bash
npm run dev
```

This runs both backend and frontend:
- **Backend API**: http://localhost:3000
- **Frontend**: http://localhost:5173

## 📊 Data Models

### Core Models

- **Project**: Real estate project with multiple units
- **Unit**: Individual property unit with status tracking
- **UnitStatusHistory**: Audit trail of status changes
- **User**: Team members with roles (Admin, Sales Agent, Operations, Finance)

### Unit Status Flow

```
AVAILABLE → INTERESTED → RESERVED → BOOKED → SOLD → HANDED_OVER
           ↓
         BLOCKED
```

### Unit Types

- STUDIO
- ONE_BR (1 Bedroom)
- TWO_BR (2 Bedroom)
- THREE_BR (3 Bedroom)
- COMMERCIAL

## 🎨 UI Features

### Unit Grid Dashboard
- **Floor × Unit matrix**: Visual representation of all units
- **Color-coded status**: Quick visual identification
- **Interactive cells**: Click to see unit details
- **Filter bar**: Filter by status, type, and floor
- **Summary counters**: Total, Available, Sold, Reserved
- **Status legend**: Reference guide for all statuses

### Project Overview
- Project information card
- Key metrics and statistics
- Unit inventory breakdown

## 📡 API Endpoints

### Projects
```
GET  /api/projects              - List all projects
GET  /api/projects/:id          - Get project with units
```

### Units
```
GET  /api/projects/:projectId/units    - List units (with filters)
GET  /api/units/:id                    - Get unit details
PATCH /api/units/:id/status            - Update unit status
```

### Statistics
```
GET  /api/projects/:projectId/stats    - Get project statistics
```

### Users
```
GET  /api/users                 - List all users
```

## 🔧 Development Commands

```bash
# Start development servers
npm run dev

# Build for production
npm run build

# Database
npm run db:push      # Push schema to database
npm run db:seed      # Seed sample data

# Workspace-specific commands
npm run dev --workspace=apps/api      # Backend only
npm run dev --workspace=apps/web      # Frontend only
```

## 📝 Seed Data Details

### Sample Project
- **Name**: Samha Tower
- **Location**: Dubai Marina
- **Total Units**: 173
- **Handover**: December 31, 2026
- **Price Range**: 600K - 3.5M AED

### Unit Distribution
- Studio: 20 units (600K - 850K)
- 1BR: 50 units (800K - 1.4M)
- 2BR: 60 units (1.2M - 2.2M)
- 3BR: 40 units (1.8M - 3.2M)
- Commercial: 3 units (2M - 3.5M)

### Status Distribution (Weighted Random)
- Available: 60%
- Sold: 18%
- Reserved: 10%
- Booked: 7%
- Blocked: 5%

### Sample Users
1. **Mohamed Admin** (ADMIN)
2. **Sara Sales** (SALES_AGENT)
3. **Khalid Sales** (SALES_AGENT)
4. **Fatima Operations** (OPERATIONS)
5. **Omar Finance** (FINANCE)

## 🔐 Authentication

Email + password auth, no third-party identity provider.

- Login flow: `POST /api/auth/login` returns a short-lived (15 min) JWT access token and sets an httpOnly refresh cookie (30 days). The frontend stores the access token in memory and refreshes it transparently on 401.
- Password reset: `POST /api/auth/forgot-password` emails a one-time link valid for 60 minutes (uses `mailerService`, falls back to logging the email if SMTP is not configured).
- Account lockout: 5 consecutive failed logins lock the account for 15 minutes.
- Seeded users all share `SEED_DEFAULT_PASSWORD` and are flagged `mustChangePassword: true` on first login.
- `JWT_SECRET` must be set; in production, `apps/api` will refuse to boot without it. Generate one with `openssl rand -base64 64`.

## 📚 Next Steps (Phases 2-5)

Based on the 9-document specification set:

### Phase 2: Contact & Lead Management
- Contact/lead creation and tracking
- Buyer profile management
- Lead scoring and qualification

### Phase 3: Sales Pipeline
- Full sales workflow automation
- Document management (SPA, Oqood)
- Payment processing and tracking

### Phase 4-5: Commission & Reporting
- Broker commission calculations
- Company vs. agent commission separation
- Multi-tower scaling
- Advanced reporting dashboards

## 🐛 Troubleshooting

### Database Connection Error
- Verify MySQL is running
- Check DATABASE_URL is correct
- Run `npm run db:push` to initialize schema

### Build Errors
- Clear node_modules: `rm -rf node_modules && npm install`
- Check TypeScript: `npm run build`

### Port Already in Use
- Change PORT in `.env` (default: 3000)
- Vite frontend uses 5173 (configurable in vite.config.ts)

## 📖 Documentation References

See the accompanying specification documents (01-09) for:
- Complete business logic
- Database design details
- API specifications
- Phase-by-phase implementation plan
- Execution checklist

## 📞 Support

Before Phase 1 implementation, prepare:
1. 173-unit Excel sheet with project data
2. User list with roles and emails
3. Answers to 8 business logic questions (see 09-EXECUTION-CHECKLIST)

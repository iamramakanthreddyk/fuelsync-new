
# FuelSync Backend

FuelSync is a **comprehensive fuel station management system** for Indian gas stations. It tracks nozzle readings, manages credit customers, tracks expenses, and provides profit/loss analytics.

## ✨ Key Features

- 🔢 **Nozzle Reading Entry** - Auto-calculates sales from meter readings
- 📊 **Dashboard Analytics** - Real-time sales, trends, fuel breakdown
- 💳 **Credit Management** - Track creditors, credit sales, settlements
- 💰 **Expense Tracking** - Categorized expenses with cost of goods
- 📈 **Profit/Loss Reports** - Monthly financial overview
- 🔐 **Role-Based Access** - Super Admin, Owner, Manager, Employee
- 🏪 **Multi-Station Support** - Owner can manage multiple stations
- 📱 **Plan-Based Limits** - SaaS-ready with subscription tiers

## 📚 Documentation

**Start here → [docs/INDEX.md](./docs/INDEX.md)**

| Document | Purpose |
|----------|---------|
| [INDEX.md](./docs/INDEX.md) | 📋 **Start here** - Document map & quick reference |
| [ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System design, data flow, models |
| [ACCESS_RULES.md](./docs/ACCESS_RULES.md) | Role permissions matrix |
| [API_REFERENCE.md](./docs/API_REFERENCE.md) | All endpoints with examples |
| [EXPANSION_GUIDE.md](./docs/EXPANSION_GUIDE.md) | How to add new features |

> ⚠️ **Maintainer Rule:** Update existing docs, don't create new files!

## 🚀 Quick Start

```bash
# 1. Install dependencies
cd backend
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL credentials

# 3. Start server (auto-creates tables)
npm run dev
```

API available at: `http://localhost:3001/api/v1`

## 🔑 Default Login

```
Email: admin@fuelsync.com
Password: admin123
Role: Super Admin
```

## 📁 Project Structure

```
backend/
├── src/                          # Source code
│   ├── app.js                    # Express app setup
│   ├── server.js                 # Entry point
│   ├── config/
│   │   └── constants.js          # Expandable configuration
│   ├── middleware/
│   │   ├── auth.js               # JWT + role verification
│   │   └── stationAccess.js      # Station ownership check
│   ├── models/                   # Sequelize models (11 tables)
│   ├── controllers/              # Business logic (7 controllers)
│   └── routes/                   # API routes (7 route files)
├── docs/                         # Documentation
├── database/                     # SQL reference
└── scripts/                      # Utility scripts
```

## 👥 Role Hierarchy

```
SUPER_ADMIN  →  Creates owners, sees all data
    │
  OWNER      →  Owns stations, views P/L, manages staff
    │
  MANAGER    →  Manages station, prices, creditors, expenses
    │
  EMPLOYEE   →  Enters readings only
```

## 📊 Core Tables

| Table | Purpose |
|-------|---------|
| `users` | All user accounts (all roles) |
| `stations` | Fuel stations (linked to owner) |
| `pumps` | Physical pump machines |
| `nozzles` | Fuel dispensing nozzles |
| `nozzle_readings` | **Core data** - sales records |
| `creditors` | Credit customers |
| `credit_transactions` | Credit sales & settlements |
| `expenses` | Daily expenses |
| `cost_of_goods` | Monthly fuel purchase costs |
| `fuel_prices` | Price history |
| `plans` | Subscription tiers |

## 🛠️ Key API Endpoints

```
# Auth
POST /api/v1/auth/login
GET  /api/v1/auth/me

# Users
GET  /api/v1/users
POST /api/v1/users              # Create user (role-based)

# Stations
GET  /api/v1/stations
POST /api/v1/stations           # Owner creates station

# Readings
GET  /api/v1/readings/form/:nozzleId
POST /api/v1/readings           # Submit reading

# Credits
GET  /api/v1/stations/:id/creditors
POST /api/v1/stations/:id/credits
POST /api/v1/stations/:id/creditors/:id/settle

# Dashboard
GET  /api/v1/dashboard/summary
GET  /api/v1/dashboard/financial-overview
GET  /api/v1/stations/:id/profit-loss
```

## 📝 NPM Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start with nodemon |
| `npm start` | Production start |
| `npm run db:sync` | Sync tables |
| `npm run db:reset` | Reset database ⚠️ |
| `npm run db:seed` | Seed default data |

## ⚙️ Environment Variables

```env
NODE_ENV=development
PORT=3001
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fuelsync
DB_USER=postgres
DB_PASSWORD=your_password
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=24h
CORS_ORIGINS=http://localhost:5173
```

## 📦 Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **ORM:** Sequelize
- **Database:** PostgreSQL
- **Auth:** JWT + bcrypt
- **Security:** Helmet, CORS, Rate Limiting

## License

MIT

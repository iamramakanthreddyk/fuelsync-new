
# 🚀 FuelSync – Smart Fuel Station Management SaaS Platform

![React](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue) ![Node.js](https://img.shields.io/badge/Node.js-18-green) ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14-blue)

**FuelSync** is a comprehensive fuel station management SaaS platform that simplifies operations through **real-time sales tracking**, and **intelligent plan-based access control**.

---

## 🎯 Platform Overview

### 💡 Core Features

* 📄 **Receipt Upload & Processing** – Upload receipts or enter readings manually
* 💰 **Sales Tracking** – Monitor daily/shift-wise sales & revenue with role-based access
* ⛽ **Fuel Price Management** – Dynamic pricing per fuel type
* 🏭 **Pump/Nozzle Configuration** – Map nozzles to fuel types with plan limits
* 📊 **Analytics Dashboard** – Charts & trends for sales performance
* 📈 **Reports Export** – PDF/Excel export support
* 👥 **Role-Based Access Control** – Super Admin, Pump Owner, Employee roles
* 📱 **Mobile-First Design** – PWA support for on-the-go management

### 📋 Plan-Based Access Control

| Plan       | Max Employees | Max Pumps | Max Stations | Monthly Price              | Features                                      |
| ---------- | ------------- | --------- | ------------ | --------------- | -------------------------- | --------------------------------------------- |
| Basic      | 2             | 3         | 1            | ₹999 (after 3-month trial) | Core features, limited operations             |
| Premium    | 5             | 5         | 1            | ₹2,499                     | Advanced analytics, more capacity             |
| Enterprise | Unlimited     | Unlimited | Unlimited    | Custom (Arrange call)      | Multi-station, unlimited access, priority support |

---

## 👥 User Roles & Permissions

### 🔧 Super Admin
- **Global Control**: Manage all users, stations, and data across the platform
- **Plan Management**: Upgrade/downgrade user plans, monitor subscriptions
- **User Management**: Create/edit/delete Pump Owners with confirmation flows
- **Analytics**: Platform-wide insights and performance metrics
- **Access**: All features without restrictions

### 🏢 Pump Owner
- **Station Management**: Manage own pumps, nozzles, sales, and uploads
- **Employee Management**: Add/remove employees within plan limits
- **Price Control**: Update fuel prices for their station
- **Analytics**: Station-specific dashboards and reports
- **Plan Limits**: Restricted by chosen plan (Basic/Premium/Enterprise)

### 👤 Employee
- **Receipt Upload**: OCR processing for fuel sales receipts
- **Limited Access**: Upload-only interface, no management features
- **Station Bound**: Access limited to assigned station data

---

## 🛠️ Tech Stack

| Component     | Technology                                |
| ------------- | ----------------------------------------- |
| **Frontend**  | React 18, TypeScript, Vite               |
| **Styling**   | Tailwind CSS, Shadcn/ui                  |
| **State**     | React Context, TanStack Query            |
| **Charts**    | Recharts                                  |
| **Backend**   | Node.js, Express, Sequelize              |
| **Database**  | PostgreSQL                               |
| **Auth**      | JWT, bcryptjs                           |
| **OCR**       | Azure Computer Vision (planned)          |
| **Storage**   | Azure Blob Storage (planned)            |
| **PWA**       | Progressive Web App, offline features    |

---

## ⚙️ Quick Start

### Prerequisites

* Node.js 18+
* PostgreSQL 14+
* Azure account (for OCR/Storage - optional for development)

### Installation

```bash
# Clone repository
git clone <your-repo-url>
cd fuelsync

# Backend setup
cd backend
npm install
cp .env.example .env
# Edit .env with your database credentials

# Database setup
npm run setup-db

# Start backend
npm run dev

# Frontend setup (new terminal)
cd ../
npm install

# Start frontend
npm run dev
```

### Environment Variables

Create `backend/.env`:

```env
NODE_ENV=development
PORT=5000
JWT_SECRET=your-super-secret-jwt-key
JWT_EXPIRATION=24h

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=fuelsync
DB_USER=your-db-user
DB_PASSWORD=your-db-password

# Azure (optional for development)
AZURE_STORAGE_CONNECTION_STRING=your-connection-string
AZURE_COMPUTER_VISION_ENDPOINT=your-endpoint
AZURE_COMPUTER_VISION_KEY=your-key
```

### Demo Credentials

After running `npm run setup-db`, use these demo accounts:

| Role        | Email                 | Password    | Plan      |
| ----------- | --------------------- | ----------- | --------- |
| Super Admin | admin@fuelsync.com    | admin123    | Premium   |
| Pump Owner  | owner@fuelsync.com    | owner123    | Basic     |
| Manager     | manager@fuelsync.com  | manager123  | Basic     |
| Employee    | employee@fuelsync.com | employee123 | Free      |

---

## 📁 Project Structure

```
fuelsync/
├── backend/                    # Node.js + Express API
│   ├── controllers/            # Business logic & API handlers
│   ├── middleware/             # Auth, validation, plan limits
│   ├── models/                 # Sequelize models
│   ├── routes/                 # API route definitions
│   ├── scripts/                # Database setup & migrations
│   └── services/               # External services (Azure, etc.)
│
├── src/                        # React frontend
│   ├── components/             # Reusable UI components
│   ├── pages/                  # Main application pages
│   ├── services/               # API service layer
│   ├── hooks/                  # Custom React hooks
│   └── types/                  # TypeScript definitions
│
├── sql/                        # Database schema & seeds
└── docs/                       # Documentation
```

---

## 🔗 API Endpoints

### Authentication
```
POST   /api/v1/auth/login       # User login
GET    /api/v1/auth/me          # Get current user
POST   /api/v1/auth/refresh     # Refresh token
POST   /api/v1/auth/logout      # User logout
```

### User Management (Super Admin)
```
GET    /api/v1/users            # Get all users
POST   /api/v1/users/employees  # Create employee (Owner)
PUT    /api/v1/users/:id/plan   # Update user plan (Super Admin)
DELETE /api/v1/users/:id        # Delete user (Super Admin)
```

### Sales & Analytics
```
GET    /api/v1/sales            # Get sales data
GET    /api/v1/sales/daily/:date # Daily summary
GET    /api/v1/sales/trends     # Sales trends
```

### Uploads & Processing
```
GET    /api/v1/uploads          # Get uploads
POST   /api/v1/uploads          # Upload receipt or manual payload
PUT    /api/v1/uploads/:id      # Update processed data
DELETE /api/v1/uploads/:id      # Delete upload
```

### Pumps & Configuration
```
GET    /api/v1/pumps            # Get pumps
POST   /api/v1/pumps            # Create pump (with plan limits)
PUT    /api/v1/pumps/:id/status # Update pump status
PUT    /api/v1/pumps/nozzles/:id/fuel-type # Update nozzle
```

### Fuel Prices
```
GET    /api/v1/prices           # Get fuel prices
PUT    /api/v1/prices           # Update fuel price
GET    /api/v1/prices/history   # Price history
GET    /api/v1/prices/comparison # Price comparison
```

---

## 🔒 Security & Access Control

### Plan Enforcement
- **Upload Limits**: Daily OCR upload limits enforced per plan
- **Resource Limits**: Max pumps, employees, stations per plan
- **Feature Access**: Premium features locked based on plan
- **API Rate Limiting**: Prevents abuse and ensures fair usage

### Role-Based Security
- **JWT Authentication**: Secure token-based authentication
- **Route Protection**: Middleware validates user permissions
- **Data Isolation**: Users only access their authorized data
- **Confirmation Flows**: Critical actions require confirmation

### Data Protection
- **Password Hashing**: bcrypt with salt rounds
- **Input Validation**: Joi schemas for all API inputs
- **SQL Injection Protection**: Sequelize ORM prevents SQL injection
- **CORS Configuration**: Proper cross-origin resource sharing

---

## 📊 Business Logic

### Plan Limits Enforcement

```javascript
// Example: Check upload limits
const todayUploads = await Upload.count({
  where: { userId, createdAt: { [Op.gte]: today } }
});

if (todayUploads >= user.plan.uploadLimit) {
  throw new Error('Daily upload limit exceeded');
}
```

### Role-Based Data Access

```javascript
// Example: Sales data filtering
let whereClause = {};
if (user.role === 'Employee') {
  whereClause.userId = user.id;
} else if (user.role === 'Pump Owner') {
  whereClause.stationId = user.stationId;
}
// Super Admin sees all data
```

---

## 🚀 Deployment

### Production Build
```bash
# Frontend build
npm run build

# Backend preparation
cd backend
npm install --production
```

### Recommended Platforms
- **Frontend**: Vercel, Netlify, Azure Static Web Apps
- **Backend**: Heroku, Railway, Azure App Service
- **Database**: Azure Database for PostgreSQL, AWS RDS

### Environment Setup
1. Set all environment variables on hosting platform
2. Configure database connection strings
3. Set up storage services if you plan to store uploaded receipts
4. Configure domain and SSL certificates

---

## 📱 Enterprise Features

### Multi-Station Management
- **Centralized Control**: Manage multiple fuel stations from one dashboard
- **Station-Specific Analytics**: Performance comparison across locations
- **Bulk Operations**: Update prices, configurations across all stations
- **Custom Pricing**: Station-specific fuel pricing strategies

### Advanced Analytics
- **Predictive Insights**: Sales forecasting and trend analysis
- **Performance Benchmarking**: Compare stations and identify optimization opportunities
- **Custom Reports**: Tailored reporting for business needs
- **API Access**: Programmatic access to data for third-party integrations

### Priority Support
- **Dedicated Account Manager**: Personal support for Enterprise customers
- **Custom Training**: Team training and onboarding assistance
- **24/7 Support**: Round-the-clock technical assistance
- **Feature Requests**: Priority consideration for custom feature development

**Contact for Enterprise**: For Enterprise plan pricing and features, please arrange a call to discuss your specific requirements.

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### Development Setup
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

MIT License – see [LICENSE](LICENSE) file for details.

---

## 🆘 Support & Documentation

- **Technical Support**: [support@fuelsync.app](mailto:support@fuelsync.app)
- **User Guide**: [User Manual](docs/user-guide.md)
- **API Documentation**: [API Guide](docs/api.md)
- **Community**: [Discord Server](https://discord.gg/fuelsync)

---

## 🏆 Why Choose FuelSync?

✅ **Reduce Manual Work**: Automate receipt processing and sales tracking  
✅ **Increase Accuracy**: Eliminate human errors in data entry  
✅ **Gain Insights**: Make data-driven decisions with real-time analytics  
✅ **Scale Efficiently**: Plan-based growth from single station to enterprise  
✅ **Save Time**: Focus on business growth, not administrative tasks  
✅ **Improve Profitability**: Optimize pricing and operations with actionable insights  

**Start your 3-month free trial today!**

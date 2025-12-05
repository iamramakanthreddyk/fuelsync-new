# 🤝 Contributing to FuelSync

Welcome! 🎉 We’re excited that you’re interested in contributing to **FuelSync**. Your help is invaluable in building a better fuel station management system.

## 🧭 Project Scope

FuelSync is a **modern fuel station management system** focused on:

* Manual meter readings and sales tracking (OCR removed)
* Sales tracking and analytics
* Pump & nozzle configuration
* Fuel price management
* Mobile-first UI with PWA support

## 🚀 How to Contribute

## 🚦 Database Migration Workflow (MANDATORY)

**All database schema changes must use Sequelize migrations.**

**Checklist for schema changes:**
- [ ] Use `npx sequelize-cli migration:generate --name <change>` to create a migration in `backend/migrations/`.
- [ ] Never edit or delete existing migration files after they are committed.
- [ ] Do not change the database schema by editing models only—always add a migration.
- [ ] Review PRs to ensure all schema changes have a corresponding migration file.
- [ ] If you change models, check if a migration is needed and add one if so.
- [ ] Never apply schema changes directly to the production database.

**CI/CD Enforcement (Recommended):**
- Add a check to fail PRs if there are model changes but no new migration file in `backend/migrations/`.
- Keep the migration folder organized and version-controlled.

**Why?**
Migrations ensure your production, staging, and development databases stay in sync and prevent data loss or drift.

### 1️⃣ Get Started

* **Fork** the repository

* **Clone** your forked repo:

  ```bash
  git clone https://github.com/your-username/fuelsync.git
  cd fuelsync
  ```

* **Install dependencies**:

  ```bash
  npm install
  ```

* **Create a branch** for your changes:

  ```bash
  git checkout -b feature/your-feature-name
  ```

### 2️⃣ Code Guidelines

✅ **Frontend**:

* Use **React (with TypeScript)**, **Tailwind CSS**, and **Shadcn/ui** components.
* Follow the existing **design system** and **component structure**.
* Write **clean, modular components** (one component = one concern).

✅ **Backend (API)**:

* Use **Express.js** and **PostgreSQL**.
* Follow RESTful API design.
* Use **async/await** and handle errors gracefully.
* Validate inputs and sanitize user data.

✅ **General**:

* Use **meaningful commit messages** (e.g., `feat: add pump configuration API`).
* Ensure **code is formatted** (Prettier/ESLint).
* Write **clear, descriptive comments** where helpful.

### 3️⃣ Test Your Changes

* Manually test UI changes (responsiveness, accessibility).
* Use tools like Postman or Thunder Client for API testing.
* Write unit tests if applicable (coming soon: automated test suite).

### 4️⃣ Submit a Pull Request

* Push your branch:

  ```bash
  git push origin feature/your-feature-name
  ```

* Open a **Pull Request** with:

  * **Clear description** of what you changed.
  * Screenshots or demo videos if applicable.
  * Link to any related issues.

### 5️⃣ PR Review & Merge

* A maintainer will review your PR.
* Address feedback promptly.
* Once approved, your changes will be merged!

---

## 🔥 Contribution Ideas

* 📄 Improve documentation (README, API docs)
* 🎨 Refine UI/UX (accessibility, design tweaks)
* ⚙️ Add unit tests
* 🔒 Enhance security (e.g., rate limiting)
* 🚀 Optimize performance (lazy loading, caching)
* 📊 Add new analytics or charts

---

## 📚 Useful Resources

* **Frontend Guide**: `docs/frontend.md`
* **Backend Guide**: `docs/backend.md`
* **API Reference**: [docs/api.md](docs/api.md)
* **Deployment Guide**: `docs/deployment.md`

---

## 🛡️ Code of Conduct

We value a **welcoming, respectful** community. Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

---

Thank you for contributing to **FuelSync**! 🚀 Let’s build something amazing together! 🌟



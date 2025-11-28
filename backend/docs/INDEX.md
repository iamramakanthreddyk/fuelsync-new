# 📚 FuelSync Documentation Index

> **Last Updated:** November 2025  
> **Version:** 2.0

This is the **single source of truth** for all FuelSync backend documentation.

---

## 🗂️ Document Map

| Document | Purpose | When to Read |
|----------|---------|--------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System design, data flow, models | Understanding the system |
| [ACCESS_RULES.md](./ACCESS_RULES.md) | Role permissions matrix | Adding features, debugging access |
| [API_REFERENCE.md](./API_REFERENCE.md) | Complete API documentation | Frontend integration |
| [EXPANSION_GUIDE.md](./EXPANSION_GUIDE.md) | How to add new features | Adding fuel types, payments, etc. |

---

## 📋 Document Descriptions

### 1. ARCHITECTURE.md
**What it covers:**
- System overview diagram
- Directory structure explanation
- Data flow (reading entry, credit, expense)
- Model relationships
- Design decisions (why we made certain choices)

**Update when:**
- Adding new models
- Changing data flow
- Modifying system architecture

---

### 2. ACCESS_RULES.md
**What it covers:**
- Role hierarchy (employee → manager → owner → super_admin)
- Permissions matrix (who can do what)
- Endpoint access table
- Multi-station access rules

**Update when:**
- Adding new endpoints
- Changing role permissions
- Adding new roles

---

### 3. API_REFERENCE.md
**What it covers:**
- All API endpoints with request/response examples
- Authentication flow
- Error codes
- Pagination and filtering

**Update when:**
- Adding new endpoints
- Changing request/response formats
- Adding new query parameters

---

### 4. EXPANSION_GUIDE.md
**What it covers:**
- Step-by-step guides for common expansions:
  - Adding fuel types
  - Adding payment methods
  - Adding expense categories
  - Adding new models/tables
  - Adding new roles
- Testing checklist

**Update when:**
- Finding new expansion patterns
- Improving existing guides

---

## 🔄 Documentation Maintenance Rules

### ✅ DO:
1. **Update existing docs** instead of creating new files
2. **Add to EXPANSION_GUIDE.md** when you discover new patterns
3. **Update ACCESS_RULES.md** when adding any endpoint
4. **Update API_REFERENCE.md** with request/response examples
5. **Keep this INDEX.md updated** with document purposes

### ❌ DON'T:
1. Create new markdown files for every change
2. Duplicate information across documents
3. Leave outdated information in docs
4. Create temporary documentation files

---

## 📁 File Organization

```
docs/
├── INDEX.md            ← You are here (start here always)
├── ARCHITECTURE.md     ← System design
├── ACCESS_RULES.md     ← Permissions
├── API_REFERENCE.md    ← API docs
└── EXPANSION_GUIDE.md  ← How to add features
```

### Deprecated Files
- `API.md` - Merged into `API_REFERENCE.md` (delete if still exists)

---

## 🎯 Quick Reference

### Role Hierarchy
```
SUPER_ADMIN (4) → OWNER (3) → MANAGER (2) → EMPLOYEE (1)
```

### Key Constants File
All expandable configurations live in:
```
src/config/constants.js
```
- FUEL_TYPES
- PAYMENT_METHODS
- EXPENSE_CATEGORIES
- USER_ROLES

### Core Tables
```
users → stations → pumps → nozzles → nozzle_readings
                     ↓
              fuel_prices
                     ↓
creditors → credit_transactions
                     ↓
expenses ← cost_of_goods
```

### API Base URL
```
http://localhost:3001/api/v1
```

---

## 📝 Changelog

### November 2025
- Created consolidated documentation structure
- Merged API.md into API_REFERENCE.md
- Added ARCHITECTURE.md, ACCESS_RULES.md, EXPANSION_GUIDE.md
- Created this INDEX.md as single entry point

### Previous
- Initial API.md created
- Basic endpoint documentation

---

## 🆘 Common Questions

**Q: Where do I add a new endpoint?**
1. Add route in `src/routes/`
2. Add controller in `src/controllers/`
3. Document in `docs/API_REFERENCE.md`
4. Add permissions in `docs/ACCESS_RULES.md`

**Q: Where do I add a new fuel type?**
See `docs/EXPANSION_GUIDE.md` → "Adding New Fuel Types"

**Q: How do I understand the data flow?**
See `docs/ARCHITECTURE.md` → "Data Flow Diagrams"

**Q: Who can access what?**
See `docs/ACCESS_RULES.md` → "Permissions Matrix"

---

> **Maintainer Note:** When in doubt, update existing docs. Don't create new files unless you have a genuinely new category of documentation.

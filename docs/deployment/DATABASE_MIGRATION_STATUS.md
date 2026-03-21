# Database Migration Status

## New Payment Tracking Fields

### Migration Created
**File:** `backend/migrations/20251204150000-add-credit-payment-fields.js`

Adds two new columns to `nozzle_readings` table:

```sql
ALTER TABLE nozzle_readings ADD COLUMN credit_amount DECIMAL(12, 2) DEFAULT 0;
ALTER TABLE nozzle_readings ADD COLUMN creditor_id UUID REFERENCES creditors(id);
CREATE INDEX idx_readings_creditor ON nozzle_readings(creditor_id);
```

### Fields Added
1. **credit_amount**
   - Type: DECIMAL(12, 2)
   - Default: 0
   - Purpose: Stores amount paid via credit for each reading
   - Allows aggregation of total credit sales per day

2. **creditor_id**
   - Type: UUID
   - References: creditors(id)
   - Purpose: Links reading to specific creditor for credit sales
   - Enables creditor balance tracking

### Complete Payment Tracking
Each reading now supports three payment methods:
```
Reading Payment Structure:
├── cashAmount (existing, DECIMAL 12,2)
├── onlineAmount (existing, DECIMAL 12,2)
└── creditAmount (NEW, DECIMAL 12,2) + creditorId (NEW, UUID)

Constraint: cashAmount + onlineAmount + creditAmount = totalAmount
```

## Running Migrations

### Development Environment
```bash
cd backend
npm run db:migrate
# or
npx sequelize-cli db:migrate
```

### Production Environment

**⚠️ IMPORTANT: Production Database Updates**

The migration needs to be run in production. Options:

#### Option 1: Automated (Recommended for Railway)
If using Railway with auto-migrations enabled:
1. Deploy new code
2. Railway automatically runs pending migrations
3. Monitor Railway logs for migration status

#### Option 2: Manual Migration
```bash
# Via SSH to production server
cd /path/to/fuelsync/backend
npx sequelize-cli db:migrate --env production
```

#### Option 3: Database Connection Script
```bash
# Run migration against production database directly
npx sequelize-cli db:migrate \
  --env production \
  --url "postgresql://user:pass@host:port/dbname"
```

## Migration Safety

✅ **Safe Features:**
- Idempotent: Can be run multiple times without breaking
- Transactional: Rolls back on error
- Backward compatible: Existing columns unchanged
- Index created for performance

⚠️ **Pre-Flight Checks:**
- Migration checks if columns already exist before adding
- Won't fail if columns present from previous run
- Safe to deploy even if migration already ran

## Verifying Migration Status

### Check if columns exist (SQL)
```sql
-- In production database
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'nozzle_readings'
  AND column_name IN ('credit_amount', 'creditor_id');
```

### Expected output:
```
 column_name  | data_type | is_nullable
--------------+-----------+------------
 credit_amount| numeric   | NO
 creditor_id  | uuid      | YES
```

### Check migration history
```sql
SELECT id, name, executed_at
FROM SequelizeMeta
WHERE name LIKE '%credit-payment%'
ORDER BY executed_at DESC;
```

## Rollback Procedure (if needed)

```bash
# Rollback last migration
npx sequelize-cli db:migrate:undo

# Rollback specific migration
npx sequelize-cli db:migrate:undo --name 20251204150000-add-credit-payment-fields.js
```

## Related Code Changes

### Backend Files Updated:
1. **readingController.js** - Accepts creditAmount, creditorId in request
2. **stationController.js** - getDailySales() aggregates payment split correctly
3. **NozzleReading.js** - Model already defines creditAmount, creditorId fields

### Frontend Changes:
1. **QuickDataEntryEnhanced.tsx** - Sends proper payment fields to backend

## Testing After Migration

✅ Checklist:
- [ ] Migration runs without errors
- [ ] Columns exist in production database
- [ ] Frontend can submit readings with credit payments
- [ ] Backend returns correct paymentSplit in getDailySales response
- [ ] Daily settlement shows accurate payment breakdown
- [ ] Credit transactions create creditor records

## Timeline

| Date | Action | Status |
|------|--------|--------|
| 2025-12-04 | Migration created | ✅ Done |
| 2025-12-04 | Code changes completed | ✅ Done |
| Pending | Deploy to production | ⏳ Awaiting deployment |
| Pending | Run migrations in prod | ⏳ Awaiting execution |
| Pending | Test in production | ⏳ Awaiting verification |

## Notes

- Migration is non-destructive
- No data loss on existing readings
- Existing readings will have credit_amount = 0 by default
- Safe to deploy and run anytime
- Can be deployed alongside code changes

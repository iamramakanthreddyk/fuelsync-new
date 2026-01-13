# Variance Tracking Implementation Guide

## Quick Start: Add Variance Visibility to Owner Dashboard

### Step 1: Create Variance Summary Endpoint (20 mins)

**File:** `backend/src/controllers/stationController.js`

Add this new function after `getSettlements()`:

```javascript
/**
 * Get variance summary for date range
 * GET /stations/:stationId/variance-summary?startDate=2026-01-01&endDate=2026-01-31
 * 
 * Returns aggregated variance metrics for period
 */
exports.getVarianceSummary = async (req, res, next) => {
  try {
    const { stationId } = req.params;
    const { startDate, endDate } = req.query;
    const user = req.user;

    // Check station access
    if (!(await canAccessStation(user, stationId))) {
      return res.status(403).json({ success: false, error: 'Access denied' });
    }

    const { Settlement } = require('../models');
    
    // Build where clause
    const where = { stationId };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date[Op.gte] = new Date(startDate);
      if (endDate) where.date[Op.lte] = new Date(endDate);
    }

    // Get all settlements in range
    const settlements = await Settlement.findAll({
      where,
      order: [['date', 'ASC']]
    });

    if (!settlements || settlements.length === 0) {
      return res.json({
        success: true,
        data: {
          periodStart: startDate,
          periodEnd: endDate,
          settlementCount: 0,
          totalVariance: 0,
          avgDailyVariance: 0,
          totalExpectedCash: 0,
          variancePercentage: 0,
          byDay: [],
          summary: {
            status: 'NO_DATA',
            message: 'No settlements recorded for this period'
          }
        }
      });
    }

    // Aggregate by day
    const byDay = {};
    let totalVariance = 0;
    let totalExpectedCash = 0;

    settlements.forEach(s => {
      const dateStr = s.date.toISOString().split('T')[0];
      const variance = parseFloat(s.variance || 0);
      const expectedCash = parseFloat(s.expectedCash || 0);

      if (!byDay[dateStr]) {
        byDay[dateStr] = {
          date: dateStr,
          variance: 0,
          expectedCash: 0,
          settlementCount: 0,
          variancePercentage: 0
        };
      }

      byDay[dateStr].variance += variance;
      byDay[dateStr].expectedCash += expectedCash;
      byDay[dateStr].settlementCount += 1;
      totalVariance += variance;
      totalExpectedCash += expectedCash;
    });

    // Calculate daily percentages
    const byDayArray = Object.values(byDay).map(day => ({
      ...day,
      variancePercentage: day.expectedCash > 0 
        ? parseFloat(((day.variance / day.expectedCash) * 100).toFixed(2))
        : 0
    }));

    // Summary statistics
    const avgDailyVariance = byDayArray.length > 0 
      ? totalVariance / byDayArray.length 
      : 0;
    const variancePercentage = totalExpectedCash > 0
      ? parseFloat(((totalVariance / totalExpectedCash) * 100).toFixed(2))
      : 0;

    // Status determination
    let status = 'HEALTHY';
    if (Math.abs(variancePercentage) > 3) {
      status = 'INVESTIGATE';
    } else if (Math.abs(variancePercentage) > 1) {
      status = 'REVIEW';
    }

    res.json({
      success: true,
      data: {
        periodStart: startDate,
        periodEnd: endDate,
        settlementCount: settlements.length,
        dayCount: byDayArray.length,
        totalVariance: parseFloat(totalVariance.toFixed(2)),
        avgDailyVariance: parseFloat(avgDailyVariance.toFixed(2)),
        totalExpectedCash: parseFloat(totalExpectedCash.toFixed(2)),
        variancePercentage,
        byDay: byDayArray,
        summary: {
          status,
          interpretation: totalVariance > 0 ? 'Shortfall' : totalVariance < 0 ? 'Overage' : 'Perfect match',
          message: status === 'HEALTHY' 
            ? `Variance is ${Math.abs(variancePercentage).toFixed(2)}% of sales (acceptable)`
            : status === 'REVIEW'
            ? `Review variance - ${Math.abs(variancePercentage).toFixed(2)}% of sales`
            : `INVESTIGATE variance - ${Math.abs(variancePercentage).toFixed(2)}% of sales`
        }
      }
    });

  } catch (error) {
    next(error);
  }
};
```

**Add to routes:** `backend/src/routes/stations.js`

```javascript
router.get('/:stationId/variance-summary', requireMinRole('manager'), stationController.getVarianceSummary);
```

**Add Op import:** At top of stationController.js:
```javascript
const { Op } = require('sequelize');
```

---

### Step 2: Add React Hook for Variance Data (15 mins)

**Create new file:** `src/hooks/useVarianceSummary.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export interface DayVarianceData {
  date: string;
  variance: number;
  expectedCash: number;
  settlementCount: number;
  variancePercentage: number;
}

export interface VarianceSummaryData {
  periodStart: string;
  periodEnd: string;
  settlementCount: number;
  dayCount: number;
  totalVariance: number;
  avgDailyVariance: number;
  totalExpectedCash: number;
  variancePercentage: number;
  byDay: DayVarianceData[];
  summary: {
    status: 'HEALTHY' | 'REVIEW' | 'INVESTIGATE' | 'NO_DATA';
    interpretation: string;
    message: string;
  };
}

export function useVarianceSummary(
  stationId: string | undefined,
  startDate: string,
  endDate: string
) {
  return useQuery({
    queryKey: ['variance-summary', stationId, startDate, endDate],
    queryFn: async () => {
      if (!stationId) return null;
      const response = await apiClient.get<{ success: boolean; data: VarianceSummaryData }>(
        `/stations/${stationId}/variance-summary?startDate=${startDate}&endDate=${endDate}`
      );
      return response?.data || null;
    },
    enabled: !!stationId && !!startDate && !!endDate
  });
}
```

---

### Step 3: Add Variance Card to Dashboard (30 mins)

**File:** `src/pages/owner/OwnerDashboard.tsx`

Add import at top:
```typescript
import { useVarianceSummary } from '@/hooks/useVarianceSummary';
```

In component, add state after other state declarations:
```typescript
const [varianceStartDate, setVarianceStartDate] = useState(() => {
  const d = new Date();
  d.setDate(1);
  return d.toISOString().split('T')[0];
});
const [varianceEndDate, setVarianceEndDate] = useState(new Date().toISOString().split('T')[0]);
```

Add hook call after other hooks:
```typescript
const { data: varianceSummary } = useVarianceSummary(
  selectedStation?.id,
  varianceStartDate,
  varianceEndDate
);
```

Add this section in the grid (find existing stats cards section):
```tsx
{/* Variance Summary Card */}
<Card className="border-2 border-orange-100 bg-gradient-to-br from-orange-50 to-red-50">
  <CardHeader className="pb-3">
    <CardTitle className="flex items-center gap-2 text-lg">
      <AlertCircle className="w-5 h-5 text-orange-600" />
      Variance Summary
    </CardTitle>
    <CardDescription>
      {varianceStartDate} to {varianceEndDate}
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {varianceSummary ? (
      <>
        {/* Period selector */}
        <div className="flex gap-2 text-xs">
          <Input
            type="date"
            value={varianceStartDate}
            onChange={(e) => setVarianceStartDate(e.target.value)}
            className="flex-1"
          />
          <Input
            type="date"
            value={varianceEndDate}
            onChange={(e) => setVarianceEndDate(e.target.value)}
            className="flex-1"
          />
        </div>

        {/* Main metrics */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Total Variance</div>
            <div className={`text-2xl font-bold ${
              varianceSummary.totalVariance >= 0 ? 'text-orange-600' : 'text-red-600'
            }`}>
              {varianceSummary.totalVariance >= 0 ? '+' : ''}₹{safeToFixed(varianceSummary.totalVariance, 2)}
            </div>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Variance %</div>
            <div className={`text-2xl font-bold ${
              Math.abs(varianceSummary.variancePercentage) <= 1 ? 'text-green-600' : 'text-red-600'
            }`}>
              {varianceSummary.variancePercentage >= 0 ? '+' : ''}{safeToFixed(varianceSummary.variancePercentage, 2)}%
            </div>
          </div>
        </div>

        {/* Status badge */}
        <Badge className={`w-full justify-center py-2 text-center font-bold ${
          varianceSummary.summary.status === 'HEALTHY' ? 'bg-green-600 text-white' :
          varianceSummary.summary.status === 'REVIEW' ? 'bg-yellow-600 text-white' :
          varianceSummary.summary.status === 'INVESTIGATE' ? 'bg-red-600 text-white' :
          'bg-gray-600 text-white'
        }`}>
          {varianceSummary.summary.status}
        </Badge>

        {/* Message */}
        <p className="text-xs text-gray-700 bg-white/50 p-2 rounded">
          {varianceSummary.summary.message}
        </p>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs border-t pt-2">
          <div>
            <span className="text-muted-foreground">Days:</span>
            <span className="font-bold ml-1">{varianceSummary.dayCount}</span>
          </div>
          <div>
            <span className="text-muted-foreground">Avg/Day:</span>
            <span className="font-bold ml-1">₹{safeToFixed(varianceSummary.avgDailyVariance, 2)}</span>
          </div>
        </div>
      </>
    ) : (
      <div className="text-sm text-muted-foreground text-center py-4">
        No variance data available
      </div>
    )}
  </CardContent>
</Card>
```

---

### Step 4: Add Variance Tab to Analytics (45 mins)

**File:** `src/pages/owner/Analytics.tsx`

Add to imports:
```typescript
import { useVarianceSummary } from '@/hooks/useVarianceSummary';
```

Add to TabsList in the existing Tabs component:
```tsx
<TabsTrigger value="variance">📊 Variance Trends</TabsTrigger>
```

Add new TabsContent before closing Tabs:
```tsx
<TabsContent value="variance" className="space-y-4">
  <VarianceAnalysisTab 
    stationId={selectedStation?.id} 
    dateRange={{ startDate, endDate }}
  />
</TabsContent>
```

Create new component (same file):
```typescript
interface VarianceAnalysisTabProps {
  stationId?: string;
  dateRange: { startDate: string; endDate: string };
}

const VarianceAnalysisTab: React.FC<VarianceAnalysisTabProps> = ({ stationId, dateRange }) => {
  const { data: varianceData, isLoading } = useVarianceSummary(
    stationId,
    dateRange.startDate,
    dateRange.endDate
  );

  if (isLoading) return <div>Loading...</div>;
  if (!varianceData) return <div>No data</div>;

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Variance"
          value={`${varianceData.totalVariance >= 0 ? '+' : ''}₹${safeToFixed(varianceData.totalVariance, 2)}`}
          subtitle={`${varianceData.totalVariance >= 0 ? 'Shortfall' : 'Overage'}`}
          icon={<TrendingDown className="w-5 h-5" />}
          color={varianceData.totalVariance >= 0 ? 'orange' : 'red'}
        />
        <StatCard
          title="Variance %"
          value={`${varianceData.variancePercentage >= 0 ? '+' : ''}${safeToFixed(varianceData.variancePercentage, 2)}%`}
          subtitle="% of expected cash"
          icon={<Percent className="w-5 h-5" />}
          color={Math.abs(varianceData.variancePercentage) <= 1 ? 'green' : 'red'}
        />
        <StatCard
          title="Avg Daily Variance"
          value={`₹${safeToFixed(varianceData.avgDailyVariance, 2)}`}
          subtitle="Average per day"
          icon={<BarChart3 className="w-5 h-5" />}
          color="blue"
        />
        <StatCard
          title="Status"
          value={varianceData.summary.status}
          subtitle={varianceData.summary.interpretation}
          icon={varianceData.summary.status === 'HEALTHY' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          color={varianceData.summary.status === 'HEALTHY' ? 'green' : 'red'}
        />
      </div>

      {/* Daily Trend Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Variance Trend</CardTitle>
          <CardDescription>Variance by day over selected period</CardDescription>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={varianceData.byDay}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip 
                formatter={(value) => `₹${value.toFixed(2)}`}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Area 
                type="monotone" 
                dataKey="variance" 
                fill="#ff6b6b" 
                stroke="#dc2626"
                name="Variance"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Daily Details Table */}
      <Card>
        <CardHeader>
          <CardTitle>Daily Details</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b">
                <tr>
                  <th className="text-left py-2 px-2">Date</th>
                  <th className="text-right py-2 px-2">Expected</th>
                  <th className="text-right py-2 px-2">Variance</th>
                  <th className="text-right py-2 px-2">%</th>
                  <th className="text-right py-2 px-2">Settlements</th>
                </tr>
              </thead>
              <tbody>
                {varianceData.byDay.map(day => (
                  <tr key={day.date} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-2">{day.date}</td>
                    <td className="text-right py-2 px-2 font-mono">₹{safeToFixed(day.expectedCash, 2)}</td>
                    <td className={`text-right py-2 px-2 font-bold font-mono ${day.variance >= 0 ? 'text-orange-600' : 'text-red-600'}`}>
                      {day.variance >= 0 ? '+' : ''}₹{safeToFixed(day.variance, 2)}
                    </td>
                    <td className={`text-right py-2 px-2 font-bold ${Math.abs(day.variancePercentage) <= 1 ? 'text-green-600' : 'text-red-600'}`}>
                      {day.variancePercentage >= 0 ? '+' : ''}{safeToFixed(day.variancePercentage, 2)}%
                    </td>
                    <td className="text-right py-2 px-2">{day.settlementCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
```

---

## Implementation Checklist

### Backend (45 mins)
- [ ] Add `getVarianceSummary` function to stationController.js
- [ ] Add route to stations.js
- [ ] Test endpoint with Postman: `GET /stations/:id/variance-summary?startDate=2026-01-01&endDate=2026-01-31`
- [ ] Verify variance calculation is correct

### Frontend (90 mins)
- [ ] Create `useVarianceSummary.ts` hook
- [ ] Add variance card to OwnerDashboard.tsx
- [ ] Add variance tab to Analytics.tsx
- [ ] Test UI loads correctly
- [ ] Test date range filtering works

### Testing
- [ ] Load dashboard with variance data
- [ ] Change date range and verify update
- [ ] Check color coding (green/yellow/red)
- [ ] Verify percentage calculations
- [ ] Test with no variance data

---

## Expected Result

After implementation, owner will see:

### On Dashboard:
- Variance card showing current month variance
- Status badge (HEALTHY/REVIEW/INVESTIGATE)
- Quick metrics (total, percentage, days)
- Date range picker for any period

### On Analytics:
- New "Variance Trends" tab
- Daily variance chart
- Summary metrics
- Detailed daily breakdown table

### Data Flow:
```
Owner sets date range → 
API aggregates settlements for that range → 
Shows total/daily/percentage variance → 
Color-coded status alerts → 
Owner can identify trends
```

---

## Future Enhancements

### Phase 2:
- [ ] Add root cause dropdown during settlement
- [ ] Variance by fuel type breakdown
- [ ] Comparison to previous period
- [ ] CSV export functionality

### Phase 3:
- [ ] Automated variance alerts (email/SMS)
- [ ] Settlement status workflow (disputed → resolved)
- [ ] AI-powered anomaly detection
- [ ] Integration with accounting software

---

## Questions to Track

1. **Is variance being recalculated correctly?** → Backend always recalculates (safe)
2. **How are multiple settlements per day handled?** → Aggregated by date
3. **What's a "normal" variance %?** → Industry standard: <1% is good, >3% investigate
4. **Should settlement 1 be final if has variance?** → No - should remain draft until reviewed
5. **How do we handle negative variance (overage)?** → Track separately, still important to investigate


# Cash Handover - Frontend Updates Needed

## 📱 UI Components to Update

### 1. CashHandoverConfirmation.tsx (Confirm Dialog)

**Current Issue:** Must enter actualAmount always  
**Fix Needed:** Add "Accept as is" button

```typescript
// Add to confirm dialog:

<Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Confirm Handover</DialogTitle>
    </DialogHeader>
    
    {/* Show expected amount */}
    <div className="space-y-4">
      <div>
        <Label>Expected Amount</Label>
        <div className="text-lg font-bold text-primary">
          ₹{handover?.expectedAmount || 0}
        </div>
      </div>
      
      {/* Option 1: Accept as is ✅ */}
      <Button 
        onClick={() => confirmHandover({ acceptAsIs: true })}
        variant="default"
        className="w-full"
      >
        ✓ Accept as is (No discrepancy)
      </Button>
      
      <Separator text="OR" />
      
      {/* Option 2: Enter different amount */}
      <div>
        <Label>Actual Amount Received</Label>
        <Input
          type="number"
          value={actualAmount}
          onChange={(e) => setActualAmount(e.target.value)}
          placeholder="Enter actual amount"
        />
        {actualAmount && Math.abs(Number(actualAmount) - (handover?.expectedAmount || 0)) > 100 && (
          <div className="text-amber-600 text-sm mt-1">
            ⚠ Discrepancy: ₹{Math.abs(Number(actualAmount) - (handover?.expectedAmount || 0))}
          </div>
        )}
      </div>
      
      <Button 
        onClick={() => confirmHandover({ actualAmount: Number(actualAmount) })}
        variant="outline"
        className="w-full"
      >
        Confirm with Amount
      </Button>
    </div>
  </DialogContent>
</Dialog>
```

---

### 2. ShiftManagement.tsx or New CashHandoverList.tsx

**Current:** Managers don't see pending handovers  
**Fix Needed:** Display pending shift_collection handovers

```typescript
// Add pending handovers section

const { data: pendingHandovers = [] } = useQuery({
  queryKey: ['pending-handovers', selectedStation],
  queryFn: () => cashHandoverService.getPendingHandovers({ stationId: selectedStation }),
  enabled: !!selectedStation
});

return (
  <div className="space-y-6">
    {/* Existing shift management code */}
    
    {/* ✅ NEW: Pending Handovers Section */}
    {pendingHandovers.length > 0 && (
      <Card>
        <CardHeader>
          <CardTitle>
            Pending Cash Confirmations ({pendingHandovers.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {pendingHandovers.map(handover => (
              <div 
                key={handover.id}
                className="flex items-center justify-between p-3 border rounded-lg"
              >
                <div>
                  <div className="font-medium">
                    {handover.fromUser?.name || 'Unknown Employee'}
                  </div>
                  <div className="text-sm text-gray-600">
                    Amount: ₹{handover.expectedAmount}
                  </div>
                  {handover.handoverType && (
                    <div className="text-xs text-gray-500 mt-1">
                      Type: {handover.handoverType.replace(/_/g, ' ')}
                    </div>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleConfirmHandover(handover.id)}
                >
                  Confirm
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    )}
  </div>
);
```

---

### 3. CashReconciliationReport.tsx

**Current:** Cannot see handover chain  
**Fix Needed:** Show handover chain with linked records

```typescript
// Add handover chain visualization

const [selectedHandover, setSelectedHandover] = useState<string | null>(null);

// Fetch related handovers in chain
const getHandoverChain = async (handover: CashHandover) => {
  const chain = [handover];
  let current = handover;
  
  // Follow previousHandoverId backwards
  while (current.previousHandoverId) {
    const prev = await cashHandoverService.getHandover(current.previousHandoverId);
    chain.unshift(prev);
    current = prev;
  }
  
  return chain;
};

return (
  <div className="space-y-6">
    {handovers.map(handover => (
      <Card key={handover.id}>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>
              {handover.handoverType.toUpperCase()}
              <Badge className="ml-2">{handover.status}</Badge>
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedHandover(
                selectedHandover === handover.id ? null : handover.id
              )}
            >
              {selectedHandover === handover.id ? 'Hide' : 'Show'} Chain
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div>From: {handover.fromUser?.name}</div>
            <div>To: {handover.toUser?.name || 'N/A'}</div>
            <div>Expected: ₹{handover.expectedAmount}</div>
            <div>Actual: ₹{handover.actualAmount}</div>
            {handover.difference && (
              <div className="text-red-600">
                Variance: ₹{handover.difference}
              </div>
            )}
          </div>
          
          {/* ✅ NEW: Show chain if selected */}
          {selectedHandover === handover.id && (
            <HandoverChain handoverId={handover.id} />
          )}
        </CardContent>
      </Card>
    ))}
  </div>
);

// New component: HandoverChain
function HandoverChain({ handoverId }: { handoverId: string }) {
  const { data: chain = [] } = useQuery({
    queryKey: ['handover-chain', handoverId],
    queryFn: async () => {
      // Implement chain fetching logic
      return [];
    }
  });
  
  return (
    <div className="mt-6 p-4 bg-gray-50 rounded-lg">
      <h4 className="font-bold mb-4">Handover Chain:</h4>
      <div className="space-y-3">
        {chain.map((h, idx) => (
          <div key={h.id} className="flex items-center">
            <div className="text-center min-w-[100px]">
              <div className="text-sm font-medium">
                {h.fromUser?.name}
              </div>
              <div className="text-xs text-gray-500">
                {new Date(h.handoverDate).toLocaleDateString()}
              </div>
            </div>
            
            <div className="flex-1 flex items-center">
              <div className="flex-1 h-0.5 bg-blue-300"></div>
              <Badge variant="outline" className="mx-2">
                {h.handoverType}
              </Badge>
              <div className="flex-1 h-0.5 bg-blue-300"></div>
            </div>
            
            <div className="text-center min-w-[100px]">
              <div className="text-sm font-medium">
                {h.toUser?.name || 'Bank'}
              </div>
              <div className={`text-xs font-bold ${
                h.status === 'confirmed' ? 'text-green-600' : 'text-amber-600'
              }`}>
                {h.status.toUpperCase()}
              </div>
            </div>
            
            {idx < chain.length - 1 && (
              <div className="ml-2 text-2xl">→</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

---

### 4. Update CashHandoverService (tenderService.ts)

**Add method to fetch handover chain:**

```typescript
export const cashHandoverService = {
  // ... existing methods ...
  
  /**
   * ✅ NEW: Get handover chain (all linked handovers)
   */
  async getHandoverChain(handoverId: string): Promise<CashHandover[]> {
    try {
      // Fetch the handover
      const handover = await this.getHandover(handoverId);
      
      const chain: CashHandover[] = [handover];
      let current = handover;
      
      // Follow the chain backwards via previousHandoverId
      while (current.previousHandoverId) {
        const prev = await this.getHandover(current.previousHandoverId);
        chain.unshift(prev);
        current = prev;
      }
      
      // Follow chain forward (find handovers that reference this one)
      const findNext = async (currentId: string) => {
        const response = await apiClient.get<ApiResponse<CashHandover[]>>(
          `/handovers?previousHandoverId=${currentId}`
        );
        if (response.success && response.data?.length) {
          return response.data[0];
        }
        return null;
      };
      
      let nextHandover = await findNext(handoverId);
      while (nextHandover) {
        chain.push(nextHandover);
        nextHandover = await findNext(nextHandover.id);
      }
      
      return chain;
    } catch (error) {
      console.error('Failed to fetch handover chain:', error);
      return [];
    }
  },
  
  /**
   * ✅ NEW: Get single handover
   */
  async getHandover(handoverId: string): Promise<CashHandover> {
    const response = await apiClient.get<ApiResponse<CashHandover>>(
      `/handovers/${handoverId}`
    );
    if (!response.success || !response.data) {
      throw new Error('Failed to fetch handover');
    }
    return response.data;
  },
  
  /**
   * ✅ UPDATED: Support acceptAsIs flag
   */
  async confirmHandover(
    handoverId: string,
    data: {
      actualAmount?: number;
      acceptAsIs?: boolean;  // ✅ NEW
      notes?: string;
    }
  ): Promise<CashHandover> {
    const response = await apiClient.post<ApiResponse<CashHandover>>(
      `/handovers/${handoverId}/confirm`,
      data
    );

    if (!response.success || !response.data) {
      throw new Error('Failed to confirm handover');
    }

    return response.data;
  }
};
```

---

### 5. Update Routes Validation (if needed)

**Backend: handovers.js route validation**

```javascript
const handoverValidators = {
  // ... existing ...
  
  // ✅ UPDATED: Support acceptAsIs
  confirm: Joi.object({
    actualAmount: Joi.number().min(0).optional(),
    acceptAsIs: Joi.boolean().optional(),  // ✅ NEW
    notes: Joi.string().max(500).optional()
  }).or('actualAmount', 'acceptAsIs')  // Either required, but not both
};
```

---

## 🎨 UI Flow Diagram

```
Manager Dashboard
        │
        ├─► Shift Management
        │   └─► Pending Handovers ✅ (NEW)
        │       └─► Employee: John
        │           Amount: ₹1,500
        │           [Confirm] Button ✅ (NEW)
        │
        └─► Cash Reconciliation Report
            └─► All Handovers List
                └─► Each Handover
                    ├─► Show Basic Info
                    ├─► [Show Chain] Button ✅ (NEW)
                    └─► If Chain Shown:
                        ├─► shift_collection (Employee John)
                        │   └─ ✓ Confirmed (Manager Mary)
                        │
                        ├─► employee_to_manager
                        │   └─ ✓ Confirmed (Owner Alex)
                        │
                        ├─► manager_to_owner  
                        │   └─ ⏳ Pending (Owner Alex)
                        │
                        └─► [None yet] Awaiting deposit_to_bank
```

---

## 🧪 Frontend Testing Checklist

- [ ] Pending handovers show in manager dashboard
- [ ] Clicking "Confirm" opens dialog with "Accept as is" button ✅
- [ ] "Accept as is" submits with acceptAsIs: true
- [ ] Can still enter custom amount
- [ ] Variance calculation shows correctly
- [ ] Handover chain displays when requested
- [ ] Each stage in chain shows status and participants
- [ ] Cannot create next stage until current confirmed (API enforces)
- [ ] Bank deposit shows linked to manager_to_owner
- [ ] UI responsive on mobile

---

## 🔌 API Contract Updates

### Confirm Handover Endpoint
```
POST /api/v1/handovers/:id/confirm

# Old Request
{
  "actualAmount": 1500,
  "notes": "Some note"
}

# ✅ NEW: Support acceptAsIs
{
  "acceptAsIs": true,
  "notes": "Some note"
}

# Or still with custom amount
{
  "actualAmount": 1500,
  "notes": "Different amount"
}
```

### Create Handover Endpoint
```
POST /api/v1/handovers

# Response now includes ✅
{
  "id": "uuid",
  "handoverType": "shift_collection",
  "fromUserId": "emp-id",
  "toUserId": "manager-id",          // ✅ AUTO-SET
  "previousHandoverId": "prev-id",    // ✅ AUTO-SET
  "expectedAmount": 1500,
  "status": "pending",
  // ... other fields
}
```

---

## 📋 Summary of Frontend Changes

| Component | Change | Priority | Status |
|-----------|--------|----------|--------|
| CashHandoverConfirmation | Add "Accept as is" button | HIGH | 🔴 TODO |
| ShiftManagement | Show pending handovers | HIGH | 🔴 TODO |
| CashReconciliationReport | Show handover chain | MEDIUM | 🔴 TODO |
| tenderService | Add chain + getHandover methods | HIGH | 🔴 TODO |
| handovers.js routes | Update validation for acceptAsIs | MEDIUM | 🟡 PARTIAL |

All backend changes are ✅ Complete.  
Frontend changes are 🔴 Pending (not blocking backend functionality).


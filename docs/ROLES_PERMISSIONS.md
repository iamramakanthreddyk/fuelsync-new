# Roles & Permissions Matrix

This document defines which user roles can access and perform each workflow action in FuelSync.

## Roles
- **Owner**: Full access to all stations, employees, cash, credit, and reports
- **Manager**: Can approve readings, confirm handovers, manage employees, view reports
- **Employee**: Can enter readings, start/end shifts, view own history

## Permissions Table

| Feature / Action                | Owner | Manager | Employee |
|---------------------------------|:-----:|:-------:|:--------:|
| Enter meter readings            |   ✓   |    ✓    |    ✓     |
| Approve/reject readings         |   ✓   |    ✓    |          |
| Start/end shift                 |   ✓   |    ✓    |    ✓     |
| Confirm cash handover           |   ✓   |    ✓    |          |
| View cash reconciliation report |   ✓   |    ✓    |          |
| Manage credit ledger            |   ✓   |    ✓    |          |
| View notifications              |   ✓   |    ✓    |    ✓     |
| Manage employees                |   ✓   |    ✓    |          |
| Manage stations                 |   ✓   |         |          |
| View own history                |   ✓   |    ✓    |    ✓     |

## Enforcement
- UI components and routes should check user role before rendering or allowing actions
- Backend APIs should validate role for sensitive actions (approval, handover, credit)
- Unauthorized access should redirect to dashboard or show error

## Example UI Enforcement
```typescript
if (!isManager && !isOwner) {
  return <Navigate to="/dashboard" />;
}
```

## Example Backend Enforcement
```js
if (user.role !== 'manager' && user.role !== 'owner') {
  return res.status(403).json({ error: 'Forbidden' });
}
```

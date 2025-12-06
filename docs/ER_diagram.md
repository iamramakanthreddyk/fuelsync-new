```mermaid
erDiagram
    PLANS {
        UUID id PK
        varchar name
        integer max_stations
        decimal price_monthly
        timestamp deleted_at
    }

    STATIONS {
        UUID id PK
        varchar name
        text address
        boolean is_active
        timestamp deleted_at
    }

    USERS {
        UUID id PK
        varchar email
        varchar name
        user_role role
        UUID station_id FK
        UUID plan_id FK
        timestamp deleted_at
    }

    PUMPS {
        UUID id PK
        UUID station_id FK
        varchar name
        integer pump_number
        equipment_status status
        timestamp deleted_at
    }

    NOZZLES {
        UUID id PK
        UUID pump_id FK
        integer nozzle_number
        fuel_type fuel_type
        decimal initial_reading
        timestamp deleted_at
    }

    FUEL_PRICES {
        UUID id PK
        UUID station_id FK
        fuel_type fuel_type
        decimal price
        date effective_from
        timestamp deleted_at
    }

    NOZZLE_READINGS {
        UUID id PK
        UUID nozzle_id FK
        UUID station_id FK
        UUID entered_by FK
        date reading_date
        decimal reading_value
        decimal litres_sold
        decimal total_amount
        timestamp deleted_at
    }

    RECONCILIATIONS {
        UUID id PK
        UUID station_id FK
        UUID performed_by FK
        date reconciliation_date
        decimal total_cash
        decimal total_online
        decimal total_sales
        decimal total_litres
        decimal expected_cash
        decimal expected_litres
        decimal cash_difference
        decimal litres_difference
        text notes
        timestamp deleted_at
    }

    AUDIT_LOGS {
        UUID id PK
        UUID station_id FK
        UUID user_id FK
        varchar action
        jsonb details
        varchar ip_address
        timestamp created_at
    }

    PLANS ||--o{ USERS : "may be assigned to"
    STATIONS ||--o{ USERS : "has many users"
    STATIONS ||--o{ PUMPS : "has many pumps"
    PUMPS ||--o{ NOZZLES : "has many nozzles"
    NOZZLES ||--o{ NOZZLE_READINGS : "has many readings"
    STATIONS ||--o{ FUEL_PRICES : "has many prices"
    USERS ||--o{ NOZZLE_READINGS : "enters readings"
    STATIONS ||--o{ RECONCILIATIONS : "has many reconciliations"
    USERS ||--o{ RECONCILIATIONS : "performs reconciliations"
    STATIONS ||--o{ AUDIT_LOGS : "has many logs"
    USERS ||--o{ AUDIT_LOGS : "creates logs"
```

## API & Database Matrix Flow

This section describes how API endpoints interact with database tables and how data flows through the system.

| API Endpoint         | DB Table(s) Involved         | Typical Flow/Interaction                |
|----------------------|-----------------------------|-----------------------------------------|
| /login               | USERS                       | Auth, role check                        |
| /stations            | STATIONS, USERS             | CRUD, assign users                      |
| /pumps               | PUMPS, STATIONS             | CRUD, link to station                   |
| /nozzles             | NOZZLES, PUMPS              | CRUD, link to pump                      |
| /fuel-prices         | FUEL_PRICES, STATIONS       | CRUD, fetch latest                      |
| /readings            | NOZZLE_READINGS, NOZZLES    | Create, fetch, aggregate                |
| /creditors           | CREDITORS, STATIONS         | CRUD, assign to station                 |
| /credit-transactions | CREDIT_TRANSACTIONS         | Create, fetch, update creditor          |
| /shifts              | SHIFTS, USERS, STATIONS     | Create, close, fetch                    |
| /cash-handovers      | CASH_HANDOVERS, SHIFTS      | Create, fetch, link to shift            |
| /reconciliation      | RECONCILIATIONS, USERS      | Create, fetch, aggregate                |
| /audit-logs          | AUDIT_LOGS, USERS, STATIONS | Log every critical action               |

### Example Data Flows

#### Sale Entry
1. User logs in (`USERS`)
2. Selects station/pump/nozzle (`STATIONS`, `PUMPS`, `NOZZLES`)
3. Enters meter reading (`NOZZLE_READINGS`)
4. API calculates litres sold, total amount, payment breakdown
5. Updates related shift/cash handover (`SHIFTS`, `CASH_HANDOVERS`)
6. Logs action (`AUDIT_LOGS`)

#### Reconciliation
1. Manager triggers reconciliation (`RECONCILIATIONS`)
2. API aggregates readings, sales, cash, online payments
3. Compares expected vs actual, records differences
4. Logs reconciliation (`AUDIT_LOGS`)

#### Credit Sale
1. User selects creditor (`CREDITORS`)
2. Records credit transaction (`CREDIT_TRANSACTIONS`)
3. Updates creditor balance
4. Logs transaction (`AUDIT_LOGS`)

### Flow Visualization (Summary)
- User/API → DB Table → Related Table(s) → Audit Log
- Most actions start with a user, interact with a main table, update related tables, and log the action.

---

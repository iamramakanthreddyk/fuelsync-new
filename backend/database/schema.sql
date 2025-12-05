-- FuelSync Database Schema
-- Clean, simplified schema for fuel station management
-- This script creates all required tables from scratch

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================
-- DROP EXISTING TABLES (Clean Start)
-- ============================================
DROP TABLE IF EXISTS nozzle_readings CASCADE;
DROP TABLE IF EXISTS fuel_prices CASCADE;
DROP TABLE IF EXISTS nozzles CASCADE;
DROP TABLE IF EXISTS pumps CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- Drop existing types
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS fuel_type CASCADE;
DROP TYPE IF EXISTS equipment_status CASCADE;
DROP TYPE IF EXISTS shift_status CASCADE;
DROP TYPE IF EXISTS credit_transaction_type CASCADE;

-- ============================================
-- ENUM TYPES
-- ============================================
CREATE TYPE user_role AS ENUM ('super_admin', 'owner', 'manager', 'employee');
CREATE TYPE fuel_type AS ENUM ('petrol', 'diesel');
CREATE TYPE equipment_status AS ENUM ('active', 'repair', 'inactive');
CREATE TYPE shift_status AS ENUM ('active', 'ended', 'cancelled');
CREATE TYPE credit_transaction_type AS ENUM ('credit', 'settlement', 'adjustment');

-- ============================================
-- PLANS TABLE
-- Subscription plans with feature limits
-- ============================================
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(50) NOT NULL UNIQUE,
    max_stations INTEGER NOT NULL DEFAULT 1,
    max_pumps_per_station INTEGER NOT NULL DEFAULT 2,
    max_nozzles_per_pump INTEGER NOT NULL DEFAULT 4,
    max_employees INTEGER NOT NULL DEFAULT 2,
    backdated_days INTEGER NOT NULL DEFAULT 3,
    analytics_days INTEGER NOT NULL DEFAULT 7,
    can_export BOOLEAN NOT NULL DEFAULT false,
    price_monthly DECIMAL(10,2) NOT NULL DEFAULT 0,
    features JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- STATIONS TABLE
-- Fuel stations (multi-tenant core)
-- ============================================
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    address TEXT,
    city VARCHAR(100),
    state VARCHAR(100),
    pincode VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(255),
    gst_number VARCHAR(20),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- ============================================
-- USERS TABLE
-- All user accounts with role-based access
-- ============================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    role user_role NOT NULL DEFAULT 'employee',
    station_id UUID REFERENCES stations(id) ON DELETE SET NULL,
    plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints: employees/managers must have a station
    CONSTRAINT chk_station_required CHECK (
        role IN ('super_admin', 'owner') OR station_id IS NOT NULL
    )
);

-- ============================================
-- PUMPS TABLE
-- Physical pump machines at stations
-- ============================================
CREATE TABLE pumps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    pump_number INTEGER NOT NULL,
    status equipment_status NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique pump number within station
    UNIQUE(station_id, pump_number)
);

-- ============================================
-- NOZZLES TABLE
-- Fuel dispensing nozzles on each pump
-- ============================================
CREATE TABLE nozzles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
    nozzle_number INTEGER NOT NULL CHECK (nozzle_number BETWEEN 1 AND 8),
    fuel_type fuel_type NOT NULL,
    status equipment_status NOT NULL DEFAULT 'active',
    initial_reading DECIMAL(12,2) DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique nozzle per pump
    UNIQUE(pump_id, nozzle_number)
);

-- ============================================
-- FUEL PRICES TABLE
-- Historical fuel prices per station
-- ============================================
CREATE TABLE fuel_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    fuel_type fuel_type NOT NULL,
    price DECIMAL(8,2) NOT NULL CHECK (price > 0),
    effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
    updated_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Only one price per fuel type per effective date
    UNIQUE(station_id, fuel_type, effective_from)
);

-- ============================================
-- NOZZLE READINGS TABLE
-- Core table: tracks meter readings and calculates sales
-- ============================================
CREATE TABLE nozzle_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- References
    nozzle_id UUID NOT NULL REFERENCES nozzles(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    entered_by UUID NOT NULL REFERENCES users(id),
    
    -- Reading data
    reading_date DATE NOT NULL,
    reading_value DECIMAL(12,2) NOT NULL CHECK (reading_value >= 0),
    previous_reading DECIMAL(12,2),
    
    -- Calculated values
    litres_sold DECIMAL(10,3) DEFAULT 0 CHECK (litres_sold >= 0),
    price_per_litre DECIMAL(8,2) CHECK (price_per_litre > 0),
    total_amount DECIMAL(12,2) DEFAULT 0 CHECK (total_amount >= 0),
    
    -- Payment breakdown
    cash_amount DECIMAL(12,2) DEFAULT 0 CHECK (cash_amount >= 0),
    online_amount DECIMAL(12,2) DEFAULT 0 CHECK (online_amount >= 0),
    
    -- Metadata
    is_initial_reading BOOLEAN DEFAULT false,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Payment should equal total (with small tolerance for rounding)
    CONSTRAINT chk_payment_total CHECK (
        is_initial_reading = true OR 
        ABS((cash_amount + online_amount) - total_amount) < 0.01
    )
);

-- ============================================
-- INDEXES FOR PERFORMANCE
-- ============================================

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_station ON users(station_id);
CREATE INDEX idx_users_role ON users(role);

-- Pumps
CREATE INDEX idx_pumps_station ON pumps(station_id);
CREATE INDEX idx_pumps_status ON pumps(status);

-- Nozzles
CREATE INDEX idx_nozzles_pump ON nozzles(pump_id);
CREATE INDEX idx_nozzles_fuel_type ON nozzles(fuel_type);
CREATE INDEX idx_nozzles_status ON nozzles(status);

-- Fuel Prices
CREATE INDEX idx_fuel_prices_station ON fuel_prices(station_id);
CREATE INDEX idx_fuel_prices_lookup ON fuel_prices(station_id, fuel_type, effective_from DESC);

-- Nozzle Readings (most important for queries)
CREATE INDEX idx_readings_nozzle ON nozzle_readings(nozzle_id);
CREATE INDEX idx_readings_station ON nozzle_readings(station_id);
CREATE INDEX idx_readings_date ON nozzle_readings(reading_date DESC);
CREATE INDEX idx_readings_nozzle_date ON nozzle_readings(nozzle_id, reading_date DESC);
CREATE INDEX idx_readings_station_date ON nozzle_readings(station_id, reading_date DESC);

-- ============================================
-- CREDITORS & CREDIT TRANSACTIONS
-- ============================================

CREATE TABLE creditors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    phone VARCHAR(50),
    email VARCHAR(255),
    address TEXT,
    business_name VARCHAR(255),
    gst_number VARCHAR(32),
    credit_limit DECIMAL(12,2) DEFAULT 0,
    credit_period_days INTEGER DEFAULT 30,
    current_balance DECIMAL(12,2) DEFAULT 0,
    last_transaction_date TIMESTAMP WITH TIME ZONE,
    last_payment_date TIMESTAMP WITH TIME ZONE,
    is_flagged BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_creditors_station ON creditors(station_id);
CREATE INDEX idx_creditors_name ON creditors(name);

CREATE TABLE credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    creditor_id UUID NOT NULL REFERENCES creditors(id) ON DELETE CASCADE,
    transaction_type credit_transaction_type NOT NULL,
    fuel_type fuel_type,
    litres DECIMAL(12,3),
    price_per_litre DECIMAL(10,2),
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    transaction_date DATE NOT NULL DEFAULT CURRENT_DATE,
    vehicle_number VARCHAR(50),
    reference_number VARCHAR(100),
    nozzle_reading_id UUID REFERENCES nozzle_readings(id),
    notes TEXT,
    entered_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_credit_transactions_creditor ON credit_transactions(creditor_id);
CREATE INDEX idx_credit_transactions_station ON credit_transactions(station_id);

-- ============================================
-- SHIFTS & CASH HANDOVERS
-- ============================================

CREATE TABLE shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    employee_id UUID REFERENCES users(id),
    shift_date DATE NOT NULL DEFAULT CURRENT_DATE,
    start_time TIME NOT NULL,
    end_time TIME,
    shift_type VARCHAR(32) DEFAULT 'custom',
    cash_collected DECIMAL(12,2),
    online_collected DECIMAL(12,2),
    expected_cash DECIMAL(12,2),
    cash_difference DECIMAL(12,2),
    opening_cash DECIMAL(12,2),
    manager_id UUID REFERENCES users(id),
    readings_count INTEGER DEFAULT 0,
    total_litres_sold DECIMAL(12,2) DEFAULT 0,
    total_sales_amount DECIMAL(12,2) DEFAULT 0,
    status shift_status DEFAULT 'active',
    ended_by UUID REFERENCES users(id),
    notes TEXT,
    end_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_shifts_station ON shifts(station_id);
CREATE INDEX idx_shifts_employee ON shifts(employee_id);
CREATE INDEX idx_shifts_status ON shifts(status);

CREATE TABLE cash_handovers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shift_id UUID REFERENCES shifts(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    handed_by UUID REFERENCES users(id),
    received_by UUID REFERENCES users(id),
    amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    status VARCHAR(20) DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_cash_handovers_station ON cash_handovers(station_id);
CREATE INDEX idx_cash_handovers_shift ON cash_handovers(shift_id);

-- ============================================
-- TRIGGER: Auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_pumps_updated_at BEFORE UPDATE ON pumps FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_nozzles_updated_at BEFORE UPDATE ON nozzles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_readings_updated_at BEFORE UPDATE ON nozzle_readings FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- SEED DATA: Default Plans
-- ============================================
INSERT INTO plans (name, max_stations, max_pumps_per_station, max_nozzles_per_pump, max_employees, backdated_days, analytics_days, can_export, price_monthly) VALUES
('Free', 1, 2, 4, 2, 3, 7, false, 0),
('Basic', 3, 6, 4, 10, 7, 30, false, 499),
('Premium', 100, 20, 8, 100, 30, 365, true, 1999);

-- ============================================
-- SEED DATA: Demo Station & Users
-- ============================================

-- Create demo station
INSERT INTO stations (id, name, address, city, state, pincode, phone) VALUES
('11111111-1111-1111-1111-111111111111', 'Demo Fuel Station', '123 Main Road', 'Hyderabad', 'Telangana', '500001', '9876543210');

-- Create demo users (password: demo123 - bcrypt hash)
-- Note: In production, use proper password hashing
INSERT INTO users (id, email, password, name, role, station_id, plan_id) VALUES
-- Super Admin (no station)
('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'admin@fuelsync.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4aFQNXJGMxWAyC.6', 'Super Admin', 'super_admin', NULL, (SELECT id FROM plans WHERE name = 'Premium')),
-- Owner
('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'owner@demo.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4aFQNXJGMxWAyC.6', 'Station Owner', 'owner', '11111111-1111-1111-1111-111111111111', (SELECT id FROM plans WHERE name = 'Basic')),
-- Manager
('cccccccc-cccc-cccc-cccc-cccccccccccc', 'manager@demo.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4aFQNXJGMxWAyC.6', 'Station Manager', 'manager', '11111111-1111-1111-1111-111111111111', NULL),
-- Employee
('dddddddd-dddd-dddd-dddd-dddddddddddd', 'employee@demo.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4aFQNXJGMxWAyC.6', 'Pump Employee', 'employee', '11111111-1111-1111-1111-111111111111', NULL);

-- Create demo pumps
INSERT INTO pumps (id, station_id, name, pump_number, status) VALUES
('22222222-2222-2222-2222-222222222201', '11111111-1111-1111-1111-111111111111', 'Pump 1', 1, 'active'),
('22222222-2222-2222-2222-222222222202', '11111111-1111-1111-1111-111111111111', 'Pump 2', 2, 'active'),
('22222222-2222-2222-2222-222222222203', '11111111-1111-1111-1111-111111111111', 'Pump 3', 3, 'repair'),
('22222222-2222-2222-2222-222222222204', '11111111-1111-1111-1111-111111111111', 'Pump 4', 4, 'active');

-- Create demo nozzles
INSERT INTO nozzles (pump_id, nozzle_number, fuel_type, status, initial_reading) VALUES
-- Pump 1
('22222222-2222-2222-2222-222222222201', 1, 'petrol', 'active', 10000),
('22222222-2222-2222-2222-222222222201', 2, 'diesel', 'active', 8000),
-- Pump 2
('22222222-2222-2222-2222-222222222202', 1, 'petrol', 'active', 15000),
('22222222-2222-2222-2222-222222222202', 2, 'diesel', 'active', 12000),
-- Pump 3 (under repair)
('22222222-2222-2222-2222-222222222203', 1, 'petrol', 'inactive', 5000),
('22222222-2222-2222-2222-222222222203', 2, 'diesel', 'inactive', 4000),
-- Pump 4
('22222222-2222-2222-2222-222222222204', 1, 'petrol', 'active', 20000),
('22222222-2222-2222-2222-222222222204', 2, 'diesel', 'active', 18000);

-- Set initial fuel prices
INSERT INTO fuel_prices (station_id, fuel_type, price, effective_from, updated_by) VALUES
('11111111-1111-1111-1111-111111111111', 'petrol', 103.50, '2024-01-01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'),
('11111111-1111-1111-1111-111111111111', 'diesel', 92.75, '2024-01-01', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb');

-- ============================================
-- HELPFUL VIEWS
-- ============================================

-- View: Current fuel prices per station
CREATE OR REPLACE VIEW current_fuel_prices AS
SELECT DISTINCT ON (station_id, fuel_type)
    station_id,
    fuel_type,
    price,
    effective_from
FROM fuel_prices
ORDER BY station_id, fuel_type, effective_from DESC;

-- View: Latest reading per nozzle
CREATE OR REPLACE VIEW latest_readings AS
SELECT DISTINCT ON (nozzle_id)
    nozzle_id,
    reading_date,
    reading_value,
    litres_sold,
    total_amount
FROM nozzle_readings
ORDER BY nozzle_id, reading_date DESC, created_at DESC;

-- View: Daily station summary
CREATE OR REPLACE VIEW daily_station_summary AS
SELECT 
    station_id,
    reading_date,
    SUM(litres_sold) as total_litres,
    SUM(total_amount) as total_amount,
    SUM(cash_amount) as total_cash,
    SUM(online_amount) as total_online,
    COUNT(*) as reading_count
FROM nozzle_readings
WHERE is_initial_reading = false
GROUP BY station_id, reading_date
ORDER BY reading_date DESC;

-- ============================================
-- DONE
-- ============================================
SELECT 'FuelSync database schema created successfully!' as status;

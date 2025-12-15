-- FuelSync Multi-Tenant Station Architecture
-- Azure PostgreSQL compatible database schema

-- First ensure pgcrypto extension is available (required for gen_random_uuid())
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Drop existing tables to recreate with proper structure
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS uploads CASCADE;
DROP TABLE IF EXISTS nozzles CASCADE;
DROP TABLE IF EXISTS pumps CASCADE;
DROP TABLE IF EXISTS fuel_prices CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS stations CASCADE;
DROP TABLE IF EXISTS plans CASCADE;

-- Drop existing types if they exist
DROP TYPE IF EXISTS user_role CASCADE;
DROP TYPE IF EXISTS fuel_type CASCADE;
DROP TYPE IF EXISTS upload_status CASCADE;
DROP TYPE IF EXISTS shift_type CASCADE;
DROP TYPE IF EXISTS plan_name CASCADE;

-- Create ENUM types
CREATE TYPE user_role AS ENUM ('super_admin', 'owner', 'manager', 'employee');
CREATE TYPE fuel_type AS ENUM ('petrol', 'diesel');
CREATE TYPE upload_status AS ENUM ('processing', 'success', 'failed');
CREATE TYPE shift_type AS ENUM ('morning', 'afternoon', 'night');
CREATE TYPE plan_name AS ENUM ('Free', 'Basic', 'Premium');

-- Plans table
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name plan_name NOT NULL UNIQUE,
    -- upload_limit removed
    max_employees INTEGER NOT NULL DEFAULT 2,
    max_pumps INTEGER NOT NULL DEFAULT 2,
    max_stations INTEGER NOT NULL DEFAULT 1,
    features JSONB NOT NULL DEFAULT '{}',
    price DECIMAL(8,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Stations table (multi-tenant core)
CREATE TABLE stations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    address JSONB, -- {street, city, state, pincode}
    contact_info JSONB, -- {phone, email, manager_name}
    license_number TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Users table with station-based isolation
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    role user_role NOT NULL DEFAULT 'employee',
    station_id UUID REFERENCES stations(id) ON DELETE CASCADE,
    plan_id UUID REFERENCES plans(id),
    custom_limits JSONB, -- Super admin overrides
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Constraints
    CONSTRAINT chk_owner_has_station CHECK (
        role != 'owner' OR station_id IS NOT NULL
    ),
    CONSTRAINT chk_employee_has_station CHECK (
        role NOT IN ('employee', 'manager') OR station_id IS NOT NULL
    )
);

-- Pumps table with station isolation
CREATE TABLE pumps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    pump_sno TEXT NOT NULL, -- Physical pump serial number
    name TEXT NOT NULL,
    location TEXT, -- Position within station
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    last_maintenance_date DATE,
    installation_date DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique pump serial within station
    UNIQUE(station_id, pump_sno)
);

-- Nozzles table with fuel type mapping
CREATE TABLE nozzles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
    nozzle_id INTEGER NOT NULL CHECK (nozzle_id BETWEEN 1 AND 8),
    fuel_type fuel_type NOT NULL,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    max_flow_rate DECIMAL(6,2), -- Litres per minute
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique nozzle per pump
    UNIQUE(pump_id, nozzle_id)
);

-- Fuel prices per station
CREATE TABLE fuel_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    fuel_type fuel_type NOT NULL,
    price DECIMAL(8,2) NOT NULL CHECK (price > 0),
    valid_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Unique active price per fuel type per station
    UNIQUE(station_id, fuel_type, valid_from)
);

-- Uploads table with station context
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    filename TEXT NOT NULL,
    original_name TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type TEXT NOT NULL,
    blob_url TEXT,
    status upload_status DEFAULT 'processing',
    error_message TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Manual readings table (normalized nozzle data)
CREATE TABLE manual_readings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    upload_id UUID REFERENCES uploads(id) ON DELETE SET NULL,
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
    nozzle_id INTEGER NOT NULL,
    pump_sno TEXT, -- For reference
    fuel_type fuel_type NOT NULL,
    cumulative_volume DECIMAL(12,3) NOT NULL CHECK (cumulative_volume >= 0),
    reading_date DATE NOT NULL,
    reading_time TIME,
    entered_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Prevent duplicate readings
    UNIQUE(station_id, pump_sno, nozzle_id, reading_date, reading_time),
    
    -- Foreign key to nozzles for validation
    FOREIGN KEY (pump_id, nozzle_id) REFERENCES nozzles(pump_id, nozzle_id)
);

-- Sales table (calculated from readings)
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    station_id UUID NOT NULL REFERENCES stations(id) ON DELETE CASCADE,
    pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
    nozzle_id INTEGER NOT NULL,
    reading_id UUID NOT NULL REFERENCES manual_readings(id) ON DELETE CASCADE,
    previous_reading_id UUID REFERENCES manual_readings(id),
    fuel_type fuel_type NOT NULL,
    litres_sold DECIMAL(10,3) NOT NULL CHECK (litres_sold >= 0),
    price_per_litre DECIMAL(8,2) NOT NULL CHECK (price_per_litre > 0),
    total_amount DECIMAL(12,2) NOT NULL CHECK (total_amount >= 0),
    sale_date DATE NOT NULL,
    shift shift_type NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    
    -- Ensure sales calculations are consistent
    CONSTRAINT chk_sales_calculation CHECK (
        total_amount = ROUND(litres_sold * price_per_litre, 2)
    )
);

-- User Activity Log table
CREATE TABLE user_activity_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    station_id INTEGER REFERENCES stations(id),
    activity_type TEXT NOT NULL,
    details JSONB,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_activity_user_id ON user_activity_log(user_id);
CREATE INDEX idx_user_activity_station_id ON user_activity_log(station_id);
CREATE INDEX idx_user_activity_type ON user_activity_log(activity_type);

-- Create comprehensive indexes for performance
CREATE INDEX idx_stations_active ON stations(is_active);
CREATE INDEX idx_users_station_role ON users(station_id, role);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_pumps_station_sno ON pumps(station_id, pump_sno);
CREATE INDEX idx_pumps_status ON pumps(status);
CREATE INDEX idx_nozzles_pump_fuel ON nozzles(pump_id, fuel_type);
CREATE INDEX idx_fuel_prices_station_type ON fuel_prices(station_id, fuel_type, valid_from DESC);
CREATE INDEX idx_uploads_station_status ON uploads(station_id, status, created_at DESC);
CREATE INDEX idx_manual_readings_station_date ON manual_readings(station_id, reading_date DESC);
CREATE INDEX idx_manual_readings_pump_nozzle ON manual_readings(pump_sno, nozzle_id, reading_date DESC);
CREATE INDEX idx_sales_station_date ON sales(station_id, sale_date DESC);
CREATE INDEX idx_sales_pump_shift ON sales(pump_id, shift, sale_date DESC);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pumps_updated_at BEFORE UPDATE ON pumps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nozzles_updated_at BEFORE UPDATE ON nozzles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_uploads_updated_at BEFORE UPDATE ON uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create views for common queries
CREATE OR REPLACE VIEW station_summary AS
SELECT 
    s.id,
    s.name,
    s.location,
    COUNT(DISTINCT p.id) as total_pumps,
    COUNT(DISTINCT n.id) as total_nozzles,
    COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'employee') as total_employees,
    COALESCE(SUM(sal.total_amount) FILTER (WHERE sal.sale_date = CURRENT_DATE), 0) as today_revenue,
    COALESCE(SUM(sal.litres_sold) FILTER (WHERE sal.sale_date = CURRENT_DATE), 0) as today_litres
FROM stations s
LEFT JOIN pumps p ON s.id = p.station_id AND p.status = 'active'
LEFT JOIN nozzles n ON p.id = n.pump_id AND n.status = 'active'
LEFT JOIN users u ON s.id = u.station_id AND u.is_active = true
LEFT JOIN sales sal ON s.id = sal.station_id
WHERE s.is_active = true
GROUP BY s.id, s.name, s.location;

CREATE OR REPLACE VIEW pump_performance AS
SELECT 
    p.id,
    p.station_id,
    p.pump_sno,
    p.name,
    p.status,
    COUNT(DISTINCT sal.id) FILTER (WHERE sal.sale_date = CURRENT_DATE) as total_sales_today,
    COALESCE(SUM(sal.total_amount) FILTER (WHERE sal.sale_date = CURRENT_DATE), 0) as revenue_today,
    COALESCE(SUM(sal.litres_sold) FILTER (WHERE sal.sale_date = CURRENT_DATE), 0) as litres_today,
    COUNT(DISTINCT n.id) as active_nozzles
FROM pumps p
LEFT JOIN nozzles n ON p.id = n.pump_id AND n.status = 'active'
LEFT JOIN sales sal ON p.id = sal.pump_id
GROUP BY p.id, p.station_id, p.pump_sno, p.name, p.status;

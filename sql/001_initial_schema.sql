-- FuelSync Database Schema
-- Azure-compatible migration script
DROP TABLE IF EXISTS plans CASCADE;
-- Plans table
CREATE TABLE plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(20) NOT NULL UNIQUE CHECK (name IN ('Free', 'Basic', 'Premium')),
    upload_limit INTEGER NOT NULL,
    features JSONB NOT NULL DEFAULT '{}',
    price DECIMAL(8,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
DROP TABLE IF EXISTS users CASCADE;
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'Employee' CHECK (role IN ('Super Admin', 'Pump Owner', 'Manager', 'Employee')),
    station_id UUID,
    plan_id UUID REFERENCES plans(id),
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS pumps CASCADE;
-- Pumps table
CREATE TABLE pumps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'maintenance')),
    station_id UUID,
    last_maintenance_date DATE,
    total_sales_today DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS nozzles CASCADE;
-- Nozzles table
CREATE TABLE nozzles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
    number INTEGER NOT NULL CHECK (number >= 1 AND number <= 10),
    fuel_type VARCHAR(10) NOT NULL CHECK (fuel_type IN ('Petrol', 'Diesel')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(pump_id, number)
);

DROP TABLE IF EXISTS uploads CASCADE;

-- Uploads table
CREATE TABLE uploads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_name VARCHAR(255) NOT NULL,
    file_size INTEGER NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    blob_url TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
    amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    litres DECIMAL(8,3) NOT NULL DEFAULT 0,
    fuel_type VARCHAR(10) NOT NULL DEFAULT 'Petrol' CHECK (fuel_type IN ('Petrol', 'Diesel')),
    processed_at TIMESTAMP WITH TIME ZONE,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS sales CASCADE;
-- Sales table
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    pump_id UUID NOT NULL REFERENCES pumps(id) ON DELETE CASCADE,
    fuel_type VARCHAR(10) NOT NULL CHECK (fuel_type IN ('Petrol', 'Diesel')),
    litres DECIMAL(8,3) NOT NULL,
    price_per_litre DECIMAL(8,2) NOT NULL,
    total_amount DECIMAL(10,2) NOT NULL,
    shift VARCHAR(20) NOT NULL CHECK (shift IN ('morning', 'afternoon', 'night')),
    upload_id UUID REFERENCES uploads(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

DROP TABLE IF EXISTS pump_nozzle_config CASCADE;
-- Pump nozzle config table
CREATE TABLE pump_nozzle_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    pump_sno TEXT NOT NULL,
    nozzle_number INT CHECK (nozzle_number BETWEEN 1 AND 4),
    fuel_type TEXT CHECK (fuel_type IN ('Petrol', 'Diesel')),
    updated_at TIMESTAMP DEFAULT NOW()
);

DROP TABLE IF EXISTS fuel_prices CASCADE;

-- Fuel prices table
CREATE TABLE fuel_prices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    fuel_type VARCHAR(10) NOT NULL UNIQUE CHECK (fuel_type IN ('Petrol', 'Diesel')),
    price DECIMAL(8,2) NOT NULL CHECK (price > 0),
    updated_by UUID NOT NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_uploads_user_id ON uploads(user_id);
CREATE INDEX idx_uploads_status ON uploads(status);
CREATE INDEX idx_uploads_created_at ON uploads(created_at);
CREATE INDEX idx_sales_user_id ON sales(user_id);
CREATE INDEX idx_sales_pump_id ON sales(pump_id);
CREATE INDEX idx_sales_created_at ON sales(created_at);
CREATE INDEX idx_sales_fuel_type ON sales(fuel_type);
CREATE INDEX idx_nozzles_pump_id ON nozzles(pump_id);

-- Triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_pumps_updated_at BEFORE UPDATE ON pumps FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_nozzles_updated_at BEFORE UPDATE ON nozzles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_uploads_updated_at BEFORE UPDATE ON uploads FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sales_updated_at BEFORE UPDATE ON sales FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_fuel_prices_updated_at BEFORE UPDATE ON fuel_prices FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();


ALTER TABLE plans ADD COLUMN "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE plans ADD COLUMN "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  CREATE TYPE "public"."enum_plans_name" AS ENUM ('Free', 'Basic', 'Premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE plans
  ALTER COLUMN name DROP DEFAULT,
  ALTER COLUMN name TYPE "public"."enum_plans_name"
  USING name::"public"."enum_plans_name";

-- Create ENUM if not exists
DO $$
BEGIN
  CREATE TYPE "public"."enum_plans_name" AS ENUM ('Free', 'Basic', 'Premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Create ENUM if not exists
DO $$
BEGIN
  CREATE TYPE "public"."enum_plans_name" AS ENUM ('Free', 'Basic', 'Premium');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- Alter column type safely
ALTER TABLE plans
  ALTER COLUMN name TYPE "public"."enum_plans_name"
  USING name::"public"."enum_plans_name";



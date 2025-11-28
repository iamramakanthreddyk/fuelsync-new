
-- Seed data for multi-tenant fuel station system

-- Insert plans
INSERT INTO plans (name, upload_limit, max_employees, max_pumps, max_stations, features, price) VALUES
('Free', 4, 2, 2, 1, '{"basicReports": true}', 0),
('Basic', 8, 5, 5, 1, '{"basicReports": true, "analytics": true, "priceManagement": true}', 299),
('Premium', -1, -1, -1, 3, '{"basicReports": true, "analytics": true, "priceManagement": true, "multiStation": true, "advancedReports": true}', 999);

-- Insert test stations
INSERT INTO stations (id, name, location, address, contact_info, license_number) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'FuelMax Central', 'Mumbai Central', 
 '{"street": "MG Road", "city": "Mumbai", "state": "Maharashtra", "pincode": "400001"}',
 '{"phone": "+91-9876543210", "email": "central@fuelmax.com", "manager": "Rajesh Kumar"}',
 'MH-FC-2024-001'),
('550e8400-e29b-41d4-a716-446655440002', 'FuelMax Highway', 'Mumbai-Pune Highway', 
 '{"street": "NH-48", "city": "Lonavala", "state": "Maharashtra", "pincode": "410401"}',
 '{"phone": "+91-9876543211", "email": "highway@fuelmax.com", "manager": "Priya Sharma"}',
 'MH-FC-2024-002'),
('550e8400-e29b-41d4-a716-446655440003', 'Green Fuel Station', 'Bangalore Electronic City', 
 '{"street": "Electronic City Phase 1", "city": "Bangalore", "state": "Karnataka", "pincode": "560100"}',
 '{"phone": "+91-9876543212", "email": "eco@greenfuel.com", "manager": "Arjun Nair"}',
 'KA-FC-2024-003');

-- Insert test users with proper hierarchy
-- Super Admin (password: admin123)
INSERT INTO users (id, name, email, password, role, plan_id) 
VALUES ('550e8400-e29b-41d4-a716-446655440010', 'System Administrator', 'admin@fuelsync.com', 
       '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'super_admin', 
       (SELECT id FROM plans WHERE name = 'Premium'));

-- Station Owners (password: owner123)
INSERT INTO users (id, name, email, password, role, station_id, plan_id) VALUES
('550e8400-e29b-41d4-a716-446655440011', 'Rajesh Kumar', 'owner@fuelsync.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'owner', 
 '550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM plans WHERE name = 'Basic')),
('550e8400-e29b-41d4-a716-446655440012', 'Priya Sharma', 'priya@fuelmax.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'owner', 
 '550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM plans WHERE name = 'Premium')),
('550e8400-e29b-41d4-a716-446655440013', 'Arjun Nair', 'arjun@greenfuel.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'owner', 
 '550e8400-e29b-41d4-a716-446655440003', (SELECT id FROM plans WHERE name = 'Free'));

-- Managers (password: manager123)
INSERT INTO users (id, name, email, password, role, station_id, plan_id) VALUES
('550e8400-e29b-41d4-a716-446655440021', 'Amit Singh', 'manager@fuelsync.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'manager', 
 '550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM plans WHERE name = 'Basic')),
('550e8400-e29b-41d4-a716-446655440022', 'Sneha Patil', 'sneha@fuelmax.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'manager', 
 '550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM plans WHERE name = 'Premium'));

-- Employees (password: employee123)
INSERT INTO users (id, name, email, password, role, station_id, plan_id) VALUES
('550e8400-e29b-41d4-a716-446655440031', 'Rohit Mehta', 'employee@fuelsync.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'employee', 
 '550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM plans WHERE name = 'Basic')),
('550e8400-e29b-41d4-a716-446655440032', 'Neha Gupta', 'neha@fuelmax.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'employee', 
 '550e8400-e29b-41d4-a716-446655440001', (SELECT id FROM plans WHERE name = 'Basic')),
('550e8400-e29b-41d4-a716-446655440033', 'Vikram Joshi', 'vikram@fuelmax.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'employee', 
 '550e8400-e29b-41d4-a716-446655440002', (SELECT id FROM plans WHERE name = 'Premium')),
('550e8400-e29b-41d4-a716-446655440034', 'Kavya Reddy', 'kavya@greenfuel.com', 
 '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'employee', 
 '550e8400-e29b-41d4-a716-446655440003', (SELECT id FROM plans WHERE name = 'Free'));

-- Insert pumps for each station
INSERT INTO pumps (id, station_id, pump_sno, name, location, status, installation_date) VALUES
-- FuelMax Central pumps
('550e8400-e29b-41d4-a716-446655440101', '550e8400-e29b-41d4-a716-446655440001', 'P001', 'Pump 1', 'Lane A1', 'active', '2023-01-15'),
('550e8400-e29b-41d4-a716-446655440102', '550e8400-e29b-41d4-a716-446655440001', 'P002', 'Pump 2', 'Lane A2', 'active', '2023-01-15'),
('550e8400-e29b-41d4-a716-446655440103', '550e8400-e29b-41d4-a716-446655440001', 'P003', 'Pump 3', 'Lane B1', 'maintenance', '2023-02-01'),

-- FuelMax Highway pumps
('550e8400-e29b-41d4-a716-446655440201', '550e8400-e29b-41d4-a716-446655440002', 'H001', 'Highway Pump 1', 'North Side', 'active', '2023-03-10'),
('550e8400-e29b-41d4-a716-446655440202', '550e8400-e29b-41d4-a716-446655440002', 'H002', 'Highway Pump 2', 'South Side', 'active', '2023-03-10'),

-- Green Fuel Station pumps
('550e8400-e29b-41d4-a716-446655440301', '550e8400-e29b-41d4-a716-446655440003', 'G001', 'Eco Pump 1', 'Main Lane', 'active', '2023-04-20');

-- Insert nozzles for each pump (standard 4 nozzles: 2 petrol, 2 diesel)
INSERT INTO nozzles (pump_id, nozzle_id, fuel_type, status, max_flow_rate) VALUES
-- FuelMax Central - Pump 1
('550e8400-e29b-41d4-a716-446655440101', 1, 'petrol', 'active', 35.5),
('550e8400-e29b-41d4-a716-446655440101', 2, 'petrol', 'active', 35.5),
('550e8400-e29b-41d4-a716-446655440101', 3, 'diesel', 'active', 40.0),
('550e8400-e29b-41d4-a716-446655440101', 4, 'diesel', 'active', 40.0),

-- FuelMax Central - Pump 2
('550e8400-e29b-41d4-a716-446655440102', 1, 'petrol', 'active', 35.5),
('550e8400-e29b-41d4-a716-446655440102', 2, 'petrol', 'active', 35.5),
('550e8400-e29b-41d4-a716-446655440102', 3, 'diesel', 'active', 40.0),
('550e8400-e29b-41d4-a716-446655440102', 4, 'diesel', 'active', 40.0),

-- FuelMax Central - Pump 3 (maintenance)
('550e8400-e29b-41d4-a716-446655440103', 1, 'petrol', 'inactive', 35.5),
('550e8400-e29b-41d4-a716-446655440103', 2, 'petrol', 'inactive', 35.5),
('550e8400-e29b-41d4-a716-446655440103', 3, 'diesel', 'inactive', 40.0),
('550e8400-e29b-41d4-a716-446655440103', 4, 'diesel', 'inactive', 40.0),

-- FuelMax Highway - Pump 1
('550e8400-e29b-41d4-a716-446655440201', 1, 'petrol', 'active', 45.0),
('550e8400-e29b-41d4-a716-446655440201', 2, 'petrol', 'active', 45.0),
('550e8400-e29b-41d4-a716-446655440201', 3, 'diesel', 'active', 50.0),
('550e8400-e29b-41d4-a716-446655440201', 4, 'diesel', 'active', 50.0),

-- FuelMax Highway - Pump 2
('550e8400-e29b-41d4-a716-446655440202', 1, 'petrol', 'active', 45.0),
('550e8400-e29b-41d4-a716-446655440202', 2, 'petrol', 'active', 45.0),
('550e8400-e29b-41d4-a716-446655440202', 3, 'diesel', 'active', 50.0),
('550e8400-e29b-41d4-a716-446655440202', 4, 'diesel', 'active', 50.0),

-- Green Fuel Station - Pump 1
('550e8400-e29b-41d4-a716-446655440301', 1, 'petrol', 'active', 30.0),
('550e8400-e29b-41d4-a716-446655440301', 2, 'petrol', 'active', 30.0),
('550e8400-e29b-41d4-a716-446655440301', 3, 'diesel', 'active', 35.0),
('550e8400-e29b-41d4-a716-446655440301', 4, 'diesel', 'active', 35.0);

-- Insert fuel prices for each station
INSERT INTO fuel_prices (station_id, fuel_type, price, valid_from, updated_by) VALUES
-- FuelMax Central prices
('550e8400-e29b-41d4-a716-446655440001', 'petrol', 106.50, '2024-06-01 00:00:00+00', '550e8400-e29b-41d4-a716-446655440011'),
('550e8400-e29b-41d4-a716-446655440001', 'diesel', 99.25, '2024-06-01 00:00:00+00', '550e8400-e29b-41d4-a716-446655440011'),

-- FuelMax Highway prices (slightly higher due to highway location)
('550e8400-e29b-41d4-a716-446655440002', 'petrol', 108.00, '2024-06-01 00:00:00+00', '550e8400-e29b-41d4-a716-446655440012'),
('550e8400-e29b-41d4-a716-446655440002', 'diesel', 101.00, '2024-06-01 00:00:00+00', '550e8400-e29b-41d4-a716-446655440012'),

-- Green Fuel Station prices (competitive)
('550e8400-e29b-41d4-a716-446655440003', 'petrol', 105.75, '2024-06-01 00:00:00+00', '550e8400-e29b-41d4-a716-446655440013'),
('550e8400-e29b-41d4-a716-446655440003', 'diesel', 98.50, '2024-06-01 00:00:00+00', '550e8400-e29b-41d4-a716-446655440013');

-- Insert sample OCR readings for demonstration (last 7 days)
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '7 days',
        CURRENT_DATE,
        INTERVAL '1 day'
    )::date as reading_date
)
INSERT INTO ocr_readings (
    station_id, pump_id, nozzle_id, pump_sno, fuel_type,
    cumulative_volume, reading_date, reading_time, 
    is_manual_entry, entered_by
)
SELECT 
    p.station_id,
    p.id as pump_id,
    n.nozzle_id,
    p.pump_sno,
    n.fuel_type,
    -- Generate increasing cumulative volumes for each day
    50000 + (EXTRACT(EPOCH FROM ds.reading_date - CURRENT_DATE + INTERVAL '7 days') / 86400)::int * 100 + 
        n.nozzle_id * 50 + (random() * 20)::int as cumulative_volume,
    ds.reading_date,
    '08:00:00'::time as reading_time,
    false,
    -- Choose a valid user from the station
    (SELECT id FROM users WHERE station_id = p.station_id AND role = 'employee' LIMIT 1)
FROM 
    date_series ds
CROSS JOIN pumps p
JOIN nozzles n ON p.id = n.pump_id
WHERE 
    p.status = 'active' 
    AND n.status = 'active'
ORDER BY 
    reading_date, pump_sno, nozzle_id;

-- Calculate and insert sales data based on OCR readings
-- For each nozzle's consecutive readings, calculate the difference and create a sale
WITH reading_pairs AS (
    SELECT 
        curr.id as current_reading_id,
        prev.id as previous_reading_id,
        curr.station_id,
        curr.pump_id,
        curr.nozzle_id,
        curr.fuel_type,
        curr.reading_date as sale_date,
        curr.cumulative_volume - prev.cumulative_volume as litres_sold,
        fp.price as price_per_litre,
        curr.entered_by
    FROM 
        ocr_readings curr
    JOIN 
        ocr_readings prev ON 
            curr.station_id = prev.station_id AND
            curr.pump_id = prev.pump_id AND
            curr.nozzle_id = prev.nozzle_id AND
            prev.reading_date = curr.reading_date - INTERVAL '1 day'
    JOIN 
        fuel_prices fp ON 
            curr.station_id = fp.station_id AND
            curr.fuel_type = fp.fuel_type
    WHERE 
        curr.cumulative_volume > prev.cumulative_volume
        AND fp.valid_from <= curr.reading_date
)
INSERT INTO sales (
    station_id, pump_id, nozzle_id, reading_id, previous_reading_id,
    fuel_type, litres_sold, price_per_litre, total_amount,
    sale_date, shift, created_by
)
SELECT 
    station_id, pump_id, nozzle_id, current_reading_id, previous_reading_id,
    fuel_type, 
    litres_sold::decimal(10,3),
    price_per_litre,
    ROUND(litres_sold * price_per_litre, 2)::decimal(12,2) as total_amount,
    sale_date,
    'morning'::shift_type,
    entered_by
FROM 
    reading_pairs;

-- Create an index to speed up future queries
CREATE INDEX IF NOT EXISTS idx_ocr_readings_pump_date ON ocr_readings(pump_id, reading_date);
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(sale_date);

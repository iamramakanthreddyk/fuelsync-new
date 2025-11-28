
-- FuelSync Database Seed Data
-- Insert initial plans and sample data

-- Insert plans
INSERT INTO plans (name, upload_limit, features, price) VALUES
('Free', 4, '{"salesTracking": true, "notifications": true}', 0),
('Basic', 8, '{"salesTracking": true, "notifications": true, "analytics": true, "priceManagement": true, "reports": true}', 299),
('Premium', 12, '{"salesTracking": true, "notifications": true, "analytics": true, "priceManagement": true, "reports": true, "multiStation": true, "adminFeatures": true}', 999);

-- Insert sample admin user (password: admin123)
-- Hash generated using bcrypt with salt rounds 12
INSERT INTO users (name, email, password, role, plan_id) 
SELECT 'System Admin', 'admin@fuelsync.com', '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'Super Admin', id 
FROM plans WHERE name = 'Premium';

-- Insert sample pump owner (password: owner123)
INSERT INTO users (name, email, password, role, plan_id) 
SELECT 'Pump Owner', 'owner@fuelsync.com', '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'Pump Owner', id 
FROM plans WHERE name = 'Basic';

-- Insert sample employee (password: employee123)
INSERT INTO users (name, email, password, role, plan_id) 
SELECT 'John Employee', 'employee@fuelsync.com', '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'Employee', id 
FROM plans WHERE name = 'Free';

-- Insert additional test users for demo
INSERT INTO users (name, email, password, role, plan_id) 
SELECT 'Sarah Manager', 'manager@fuelsync.com', '$2a$12$LQv3c1yqBwEHJ/OKL2XfOOHyFaFDK8K8Y0XQNOXwpx7LfGMGzV/ta', 'Manager', id 
FROM plans WHERE name = 'Basic';

-- Insert sample pumps
INSERT INTO pumps (name, status, last_maintenance_date) VALUES
('Pump 1', 'active', '2024-05-15'),
('Pump 2', 'active', '2024-05-20'),
('Pump 3', 'maintenance', '2024-05-10'),
('Pump 4', 'inactive', '2024-04-30');

-- Insert nozzles for each pump (4 nozzles per pump)
INSERT INTO nozzles (pump_id, number, fuel_type, status)
SELECT 
    p.id,
    n.number,
    CASE 
        WHEN n.number <= 2 THEN 'Petrol'
        ELSE 'Diesel'
    END as fuel_type,
    CASE 
        WHEN p.status = 'active' THEN 'active'
        ELSE 'inactive'
    END as status
FROM pumps p
CROSS JOIN (
    SELECT 1 as number UNION ALL
    SELECT 2 UNION ALL
    SELECT 3 UNION ALL
    SELECT 4
) n;

-- Insert initial fuel prices
INSERT INTO fuel_prices (fuel_type, price, updated_by) 
SELECT 'Petrol', 105.50, id FROM users WHERE role = 'Super Admin' LIMIT 1;

INSERT INTO fuel_prices (fuel_type, price, updated_by) 
SELECT 'Diesel', 98.75, id FROM users WHERE role = 'Super Admin' LIMIT 1;

-- Insert sample sales data for the last 30 days
WITH date_series AS (
    SELECT generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '1 day',
        INTERVAL '1 day'
    )::date as sale_date
),
sample_sales AS (
    SELECT 
        ds.sale_date,
        p.id as pump_id,
        u.id as user_id,
        (ARRAY['Petrol', 'Diesel'])[floor(random() * 2 + 1)] as fuel_type,
        (random() * 50 + 10)::decimal(8,3) as litres,
        CASE 
            WHEN (ARRAY['Petrol', 'Diesel'])[floor(random() * 2 + 1)] = 'Petrol' 
            THEN 105.50 
            ELSE 98.75 
        END as price_per_litre,
        (ARRAY['morning', 'afternoon', 'night'])[floor(random() * 3 + 1)] as shift
    FROM date_series ds
    CROSS JOIN pumps p
    CROSS JOIN users u
    WHERE p.status = 'active' 
    AND u.role != 'Super Admin'
    AND random() < 0.3  -- 30% chance of sale per pump per day
    LIMIT 500  -- Limit total sample sales
)
INSERT INTO sales (user_id, pump_id, fuel_type, litres, price_per_litre, total_amount, shift, created_at)
SELECT 
    user_id,
    pump_id,
    fuel_type,
    litres,
    price_per_litre,
    litres * price_per_litre as total_amount,
    shift,
    sale_date + (random() * INTERVAL '24 hours') as created_at
FROM sample_sales;

-- Insert sample uploads for testing
INSERT INTO uploads (user_id, filename, original_name, file_size, mime_type, status, amount, litres, fuel_type, processed_at, ocr_data)
SELECT 
    u.id,
    'receipt_' || generate_random_uuid() || '.jpg',
    'receipt_' || row_number() OVER() || '.jpg',
    floor(random() * 1000000 + 100000)::integer,
    'image/jpeg',
    (ARRAY['success', 'processing', 'failed'])[floor(random() * 3 + 1)],
    (random() * 5000 + 500)::decimal(10,2),
    (random() * 50 + 5)::decimal(8,3),
    (ARRAY['Petrol', 'Diesel'])[floor(random() * 2 + 1)],
    CURRENT_TIMESTAMP - (random() * INTERVAL '30 days'),
    '{"amount": 1250.50, "litres": 12.5, "fuelType": "Petrol", "confidence": 0.95}'::jsonb
FROM users u
WHERE u.role IN ('Employee', 'Manager', 'Pump Owner')
LIMIT 50;

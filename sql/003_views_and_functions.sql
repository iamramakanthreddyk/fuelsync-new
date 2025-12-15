
-- FuelSync Database Views and Functions
-- Useful views and functions for reporting and analytics

-- Daily sales summary view
CREATE OR REPLACE VIEW daily_sales_summary AS
SELECT 
    DATE(created_at) as sale_date,
    COUNT(*) as total_transactions,
    SUM(total_amount) as total_revenue,
    SUM(litres) as total_litres,
    AVG(price_per_litre) as avg_price_per_litre,
    COUNT(DISTINCT pump_id) as active_pumps,
    COUNT(CASE WHEN fuel_type = 'Petrol' THEN 1 END) as petrol_transactions,
    COUNT(CASE WHEN fuel_type = 'Diesel' THEN 1 END) as diesel_transactions,
    SUM(CASE WHEN fuel_type = 'Petrol' THEN total_amount ELSE 0 END) as petrol_revenue,
    SUM(CASE WHEN fuel_type = 'Diesel' THEN total_amount ELSE 0 END) as diesel_revenue
FROM sales
GROUP BY DATE(created_at)
ORDER BY sale_date DESC;

-- Pump performance view
CREATE OR REPLACE VIEW pump_performance AS
SELECT 
    p.id,
    p.name,
    p.status,
    COUNT(s.id) as total_sales,
    COALESCE(SUM(s.total_amount), 0) as total_revenue,
    COALESCE(SUM(s.litres), 0) as total_litres,
    COALESCE(AVG(s.total_amount), 0) as avg_sale_amount,
    COUNT(CASE WHEN s.created_at >= CURRENT_DATE THEN 1 END) as today_sales,
    COALESCE(SUM(CASE WHEN s.created_at >= CURRENT_DATE THEN s.total_amount ELSE 0 END), 0) as today_revenue
FROM pumps p
LEFT JOIN sales s ON p.id = s.pump_id
GROUP BY p.id, p.name, p.status
ORDER BY total_revenue DESC;

-- User upload statistics view
CREATE OR REPLACE VIEW user_upload_stats AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    p.name as plan_name,
    -- p.upload_limit removed
    COUNT(up.id) as total_uploads,
    COUNT(CASE WHEN up.status = 'success' THEN 1 END) as successful_uploads,
    COUNT(CASE WHEN up.status = 'failed' THEN 1 END) as failed_uploads,
    COUNT(CASE WHEN up.created_at >= CURRENT_DATE THEN 1 END) as today_uploads,
    COALESCE(AVG(up.file_size), 0) as avg_file_size
FROM users u
LEFT JOIN plans p ON u.plan_id = p.id
LEFT JOIN uploads up ON u.id = up.user_id
GROUP BY u.id, u.name, u.email, u.role, p.name
ORDER BY total_uploads DESC;

-- Function to get sales trends
CREATE OR REPLACE FUNCTION get_sales_trends(days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    sale_date DATE,
    total_revenue DECIMAL(12,2),
    total_litres DECIMAL(10,3),
    total_transactions BIGINT,
    revenue_change_percent DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    WITH daily_sales AS (
        SELECT 
            DATE(s.created_at) as date,
            SUM(s.total_amount) as revenue,
            SUM(s.litres) as litres,
            COUNT(*) as transactions
        FROM sales s
        WHERE s.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
        GROUP BY DATE(s.created_at)
        ORDER BY DATE(s.created_at)
    ),
    sales_with_lag AS (
        SELECT 
            *,
            LAG(revenue) OVER (ORDER BY date) as prev_revenue
        FROM daily_sales
    )
    SELECT 
        date as sale_date,
        revenue as total_revenue,
        litres as total_litres,
        transactions as total_transactions,
        CASE 
            WHEN prev_revenue IS NULL OR prev_revenue = 0 THEN 0
            ELSE ROUND(((revenue - prev_revenue) / prev_revenue * 100)::DECIMAL, 2)
        END as revenue_change_percent
    FROM sales_with_lag
    ORDER BY date DESC;
END;
$$ LANGUAGE plpgsql;

-- Function to check upload limits
-- CREATE OR REPLACE FUNCTION check_upload_limit(user_uuid UUID) (removed)
RETURNS BOOLEAN AS $$
DECLARE
    user_plan_limit INTEGER;
    today_uploads INTEGER;
BEGIN
    -- Get user's plan upload limit
    -- SELECT p.upload_limit INTO user_plan_limit (removed)
    FROM users u
    JOIN plans p ON u.plan_id = p.id
    WHERE u.id = user_uuid;
    
    -- If no limit found, default to free plan (4 uploads)
    IF user_plan_limit IS NULL THEN
        user_plan_limit := 4;
    END IF;
    
    -- If unlimited uploads (12), always allow
    IF user_plan_limit = 12 THEN
        RETURN TRUE;
    END IF;
    
    -- Count today's uploads
    SELECT COUNT(*) INTO today_uploads
    FROM uploads
    WHERE user_id = user_uuid
    AND created_at >= CURRENT_DATE;
    
    -- Return true if under limit
    RETURN today_uploads < user_plan_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate pump efficiency
CREATE OR REPLACE FUNCTION calculate_pump_efficiency(pump_uuid UUID, days_back INTEGER DEFAULT 30)
RETURNS TABLE (
    pump_name VARCHAR(100),
    total_sales BIGINT,
    total_revenue DECIMAL(12,2),
    total_litres DECIMAL(10,3),
    avg_sale_amount DECIMAL(8,2),
    efficiency_score DECIMAL(5,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.name as pump_name,
        COUNT(s.id) as total_sales,
        COALESCE(SUM(s.total_amount), 0) as total_revenue,
        COALESCE(SUM(s.litres), 0) as total_litres,
        COALESCE(AVG(s.total_amount), 0) as avg_sale_amount,
        -- Efficiency score based on sales volume and revenue
        CASE 
            WHEN COUNT(s.id) = 0 THEN 0
            ELSE ROUND((COUNT(s.id)::DECIMAL / days_back * 10 + 
                       COALESCE(SUM(s.total_amount), 0) / 10000)::DECIMAL, 2)
        END as efficiency_score
    FROM pumps p
    LEFT JOIN sales s ON p.id = s.pump_id 
        AND s.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
    WHERE p.id = pump_uuid
    GROUP BY p.id, p.name;
END;
$$ LANGUAGE plpgsql;

-- Create indexes on views for better performance
CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(DATE(created_at));
CREATE INDEX IF NOT EXISTS idx_uploads_user_date ON uploads(user_id, DATE(created_at));

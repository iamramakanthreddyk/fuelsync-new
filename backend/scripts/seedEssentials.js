/**
 * Essential Data Seeding Script
 *
 * Seeds only the critical data needed for the app to function:
 * - Subscription Plans (Free, Basic, Premium, Enterprise) - PRICING IN RUPEES (₹)
 * - Super Admin user
 *
 * This runs automatically when the backend starts.
 * This is the ONLY seeding script - no additional sample data is created.
 *
 * PRICING: All amounts are in Indian Rupees (₹)
 */const { sequelize } = require('../src/models');
const { User, Plan } = require('../src/models');
const bcrypt = require('bcryptjs');

async function seedEssentials() {
  try {
    console.log('🔍 Checking essential data...');

    // Check if plans exist
    const planCount = await Plan.count();
    
    if (planCount === 0) {
      console.log('📋 Seeding subscription plans...');
      
      await Plan.bulkCreate([
        {
          name: 'Free',
          description: 'Free plan',
          priceMonthly: 0, // ₹0/month
          priceYearly: 0, // ₹0/year
          billingCycle: 'monthly',
          maxStations: 1,
          maxPumpsPerStation: 2,
          maxNozzlesPerPump: 4,
          maxEmployees: 2,
          features: {
            basic_readings: true,
            fuel_prices: true,
            daily_reports: false,
            analytics: false,
            credit_management: false,
            expense_tracking: false,
            multi_station: false
          },
          isActive: true
        },
        {
          name: 'Basic',
          description: 'Basic plan',
          priceMonthly: 999, // ₹999/month
          priceYearly: 9990, // ₹9990/year
          billingCycle: 'monthly',
          maxStations: 3,
          maxPumpsPerStation: 10,
          maxNozzlesPerPump: 4,
          maxEmployees: 10,
          features: {
            basic_readings: true,
            fuel_prices: true,
            daily_reports: true,
            analytics: true,
            credit_management: true,
            expense_tracking: true,
            multi_station: true,
            tank_management: true
          },
          isActive: true
        },
        {
          name: 'Premium',
          description: 'Premium plan',
          priceMonthly: 2499, // ₹2499/month
          priceYearly: 24990, // ₹24990/year
          billingCycle: 'monthly',
          maxStations: 10,
          maxPumpsPerStation: 50,
          maxNozzlesPerPump: 8,
          maxEmployees: 50,
          features: {
            basic_readings: true,
            fuel_prices: true,
            daily_reports: true,
            analytics: true,
            credit_management: true,
            expense_tracking: true,
            multi_station: true,
            tank_management: true,
            advanced_analytics: true,
            api_access: true,
            priority_support: true
          },
          isActive: true
        },
        {
          name: 'Enterprise',
          description: 'Enterprise plan',
          priceMonthly: 4999, // ₹4999/month
          priceYearly: 49990, // ₹49990/year
          billingCycle: 'monthly',
          maxStations: 999, // effectively unlimited
          maxPumpsPerStation: 999,
          maxNozzlesPerPump: 12,
          maxEmployees: 999,
          features: {
            basic_readings: true,
            fuel_prices: true,
            daily_reports: true,
            analytics: true,
            credit_management: true,
            expense_tracking: true,
            multi_station: true,
            tank_management: true,
            advanced_analytics: true,
            api_access: true,
            priority_support: true,
            custom_integrations: true,
            dedicated_support: true,
            white_label: true
          },
          isActive: true
        }
      ]);
      
      console.log('✅ Plans seeded');
    } else {
      console.log('✓ Plans already exist');
    }

    // Check if admin exists
    const adminExists = await User.findOne({ where: { email: 'admin@fuelsync.com' } });
    
    if (!adminExists) {
      console.log('👤 Creating super admin user...');
      
      // Don't hash here - User model's beforeCreate hook will hash it
      await User.create({
        email: 'admin@fuelsync.com',
        password: process.env.ADMIN_PASSWORD || 'admin123', // Use env or fallback for dev
        name: 'System Administrator',
        phone: '+919999999999',
        role: 'super_admin',
        isActive: true
      });
      
      console.log('✅ Super admin created (admin@fuelsync.com / admin123)');
    } else {
      console.log('✓ Super admin already exists');
    }

    console.log('✅ Essential data ready\n');
    
  } catch (error) {
    console.error('❌ Error seeding essential data:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedEssentials()
    .then(() => {
      console.log('✅ Done');
      process.exit(0);
    })
    .catch((error) => {
      console.error('❌ Failed:', error);
      process.exit(1);
    });
}

module.exports = seedEssentials;

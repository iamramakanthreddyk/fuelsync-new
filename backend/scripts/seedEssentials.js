/**
 * Essential Data Seeding Script
 * 
 * Seeds only the critical data needed for the app to function:
 * - Subscription Plans (Free, Basic, Premium, Enterprise)
 * - Super Admin user
 * 
 * This runs automatically when the backend starts.
 * For full sample data, run: npm run seed
 */

const { sequelize } = require('../src/models');
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
          price: 0,
          billingCycle: 'monthly',
          maxStations: 1,
          maxPumps: 2,
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
          price: 999,
          billingCycle: 'monthly',
          maxStations: 3,
          maxPumps: 10,
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
          price: 2499,
          billingCycle: 'monthly',
          maxStations: 10,
          maxPumps: 50,
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
          price: 4999,
          billingCycle: 'monthly',
          maxStations: 999, // effectively unlimited
          maxPumps: 999,
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
        password: 'admin123',
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

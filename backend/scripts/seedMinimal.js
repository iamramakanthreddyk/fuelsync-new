/**
 * Minimal FuelSync Seed Script
 * Creates 4 plans (Free, Basic, Premium, Enterprise) and 1 super admin user
 * Usage: node scripts/seedMinimal.js
 */

const bcrypt = require('bcryptjs');
const { sequelize, Plan, User } = require('../src/models');

async function main() {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connected');

    // Seed plans
    await Plan.bulkCreate([
      {
        name: 'Free',
        description: 'Perfect for getting started - single station with basic features',
        maxStations: 1,
        maxPumpsPerStation: 2,
        maxNozzlesPerPump: 4,
        maxEmployees: 2,
        maxCreditors: 10,
        backdatedDays: 3,
        analyticsDays: 7,
        canExport: false,
        canTrackExpenses: false,
        canTrackCredits: true,
        canViewProfitLoss: false,
        priceMonthly: 0,
        priceYearly: 0,
        sortOrder: 0,
        isActive: true
      },
      {
        name: 'Basic',
        description: 'Great for small stations - up to 3 stations with full features',
        maxStations: 3,
        maxPumpsPerStation: 5,
        maxNozzlesPerPump: 4,
        maxEmployees: 10,
        maxCreditors: 50,
        backdatedDays: 7,
        analyticsDays: 30,
        canExport: true,
        canTrackExpenses: true,
        canTrackCredits: true,
        canViewProfitLoss: true,
        priceMonthly: 999,
        priceYearly: 9999,
        sortOrder: 1,
        isActive: true
      },
      {
        name: 'Premium',
        description: 'For growing businesses - 10 stations with advanced analytics',
        maxStations: 10,
        maxPumpsPerStation: 10,
        maxNozzlesPerPump: 4,
        maxEmployees: 50,
        maxCreditors: 500,
        backdatedDays: 30,
        analyticsDays: 365,
        canExport: true,
        canTrackExpenses: true,
        canTrackCredits: true,
        canViewProfitLoss: true,
        priceMonthly: 2499,
        priceYearly: 24999,
        sortOrder: 2,
        isActive: true
      },
      {
        name: 'Enterprise',
        description: 'Unlimited everything for large operations',
        maxStations: 999,
        maxPumpsPerStation: 50,
        maxNozzlesPerPump: 6,
        maxEmployees: 500,
        maxCreditors: 5000,
        backdatedDays: 90,
        analyticsDays: 730,
        canExport: true,
        canTrackExpenses: true,
        canTrackCredits: true,
        canViewProfitLoss: true,
        priceMonthly: 9999,
        priceYearly: 99999,
        sortOrder: 3,
        isActive: true
      }
    ], { ignoreDuplicates: true });
    console.log('✅ Plans seeded');

    // Seed super admin
    const adminEmail = 'admin@fuelsync.com';
    const adminPassword = 'admin123';
    const hashedPassword = await bcrypt.hash(adminPassword, 10);
    await User.findOrCreate({
      where: { email: adminEmail },
      defaults: {
        name: 'Super Administrator',
        email: adminEmail,
        password: hashedPassword,
        role: 'super_admin',
        isActive: true
      }
    });
    console.log('✅ Super admin seeded');

    console.log('\nMinimal seed complete!\nLogin: admin@fuelsync.com / admin123');
    process.exit(0);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

main();

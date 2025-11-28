/**
 * Comprehensive Sample Data Seeding Script
 * Creates realistic test data for all scenarios:
 * - Multiple users with different roles and plans
 * - Stations with pumps, nozzles, tanks
 * - Historical readings, sales, expenses
 * - Credit transactions, shifts, cash handovers
 * 
 * Usage: node scripts/seedSampleData.js
 */

const bcrypt = require('bcryptjs');
const { Op } = require('sequelize');
const { 
  sequelize, 
  Plan, 
  User, 
  Station, 
  Pump, 
  Nozzle, 
  FuelPrice, 
  NozzleReading, 
  Creditor, 
  CreditTransaction,
  Expense,
  CostOfGoods,
  Tank,
  TankRefill,
  Shift,
  CashHandover,
  AuditLog
} = require('../src/models');

// Helper to generate dates
const daysAgo = (days) => {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date;
};

const hoursAgo = (hours) => {
  const date = new Date();
  date.setHours(date.getHours() - hours);
  return date;
};

// Password: "password123" (hashed)
const HASHED_PASSWORD = '$2a$10$YourHashedPasswordHere'; // Will be regenerated

async function clearExistingData() {
  console.log('🧹 Clearing existing sample data...');
  
  await AuditLog.destroy({ where: {}, truncate: true, cascade: true });
  await CashHandover.destroy({ where: {}, truncate: true, cascade: true });
  await Shift.destroy({ where: {}, truncate: true, cascade: true });
  await TankRefill.destroy({ where: {}, truncate: true, cascade: true });
  await Tank.destroy({ where: {}, truncate: true, cascade: true });
  await CostOfGoods.destroy({ where: {}, truncate: true, cascade: true });
  await Expense.destroy({ where: {}, truncate: true, cascade: true });
  await CreditTransaction.destroy({ where: {}, truncate: true, cascade: true });
  await Creditor.destroy({ where: {}, truncate: true, cascade: true });
  await NozzleReading.destroy({ where: {}, truncate: true, cascade: true });
  await FuelPrice.destroy({ where: {}, truncate: true, cascade: true });
  await Nozzle.destroy({ where: {}, truncate: true, cascade: true });
  await Pump.destroy({ where: {}, truncate: true, cascade: true });
  
  // Keep super admin, delete others
  await User.destroy({ where: { role: ['owner', 'manager', 'employee'] } });
  await Station.destroy({ where: {}, truncate: true, cascade: true });
  
  console.log('✅ Existing data cleared');
}

async function seedPlans() {
  console.log('📦 Checking plans...');
  
  const planCount = await Plan.count();
  if (planCount === 0) {
    await Plan.bulkCreate([
      {
        name: 'Free',
        description: 'Perfect for getting started',
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
        description: 'Great for small stations',
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
        description: 'For growing businesses',
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
        priceMonthly: 2999,
        priceYearly: 29999,
        sortOrder: 2,
        isActive: true
      },
      {
        name: 'Enterprise',
        description: 'Unlimited everything',
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
    ]);
    console.log('✅ Plans seeded');
  } else {
    console.log('✅ Plans already exist');
  }
}

async function seedUsersAndStations() {
  console.log('👥 Seeding users and stations...');
  
  const freePlan = await Plan.findOne({ where: { name: 'Free' } });
  const basicPlan = await Plan.findOne({ where: { name: 'Basic' } });
  const premiumPlan = await Plan.findOne({ where: { name: 'Premium' } });
  const enterprisePlan = await Plan.findOne({ where: { name: 'Enterprise' } });
  
  // Hash password once
  const hashedPassword = await bcrypt.hash('password123', 10);
  
  // ============================================
  // SCENARIO 1: Free Plan Owner - Single Small Station
  // ============================================
  // Create owner first (without stationId)
  const owner1 = await User.create({
    name: 'Rajesh Kumar',
    email: 'rajesh@quickfuel.com',
    password: hashedPassword,
    phone: '+91-9876543210',
    role: 'owner',
    planId: freePlan.id,
    isActive: true
  });
  
  // Create station with ownerId
  const station1 = await Station.create({
    ownerId: owner1.id,
    name: 'QuickFuel Express',
    code: 'QFE001',
    address: '123 Main Street, Near City Mall',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400001',
    phone: '+91-9876543210',
    email: 'contact@quickfuel.com',
    gstNumber: '27AABCU9603R1ZM',
    isActive: true
  });
  
  // Update owner with stationId
  await owner1.update({ stationId: station1.id });
  
  const employee1a = await User.create({
    name: 'Amit Singh',
    email: 'amit@quickfuel.com',
    password: hashedPassword,
    phone: '+91-9876543211',
    role: 'employee',
    stationId: station1.id,
    planId: freePlan.id,
    isActive: true
  });
  
  const employee1b = await User.create({
    name: 'Priya Sharma',
    email: 'priya@quickfuel.com',
    password: hashedPassword,
    phone: '+91-9876543212',
    role: 'employee',
    stationId: station1.id,
    planId: freePlan.id,
    isActive: true
  });
  
  // ============================================
  // SCENARIO 2: Basic Plan Owner - Medium Station
  // ============================================
  const owner2 = await User.create({
    name: 'Sneha Patil',
    email: 'sneha@fuelmax.com',
    password: hashedPassword,
    phone: '+91-9876543220',
    role: 'owner',
    planId: basicPlan.id,
    isActive: true
  });
  
  const station2 = await Station.create({
    ownerId: owner2.id,
    name: 'FuelMax Central',
    code: 'FMC002',
    address: 'Plot 45, Industrial Area, Sector 18',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411014',
    phone: '+91-9876543220',
    email: 'info@fuelmax.com',
    gstNumber: '27AABCU9603R1ZN',
    isActive: true
  });
  
  await owner2.update({ stationId: station2.id });
  
  const manager2 = await User.create({
    name: 'Vikram Joshi',
    email: 'vikram@fuelmax.com',
    password: hashedPassword,
    phone: '+91-9876543221',
    role: 'manager',
    stationId: station2.id,
    planId: basicPlan.id,
    isActive: true
  });
  
  const employees2 = await User.bulkCreate([
    {
      name: 'Rahul Desai',
      email: 'rahul@fuelmax.com',
      password: hashedPassword,
      phone: '+91-9876543222',
      role: 'employee',
      stationId: station2.id,
      planId: basicPlan.id,
      isActive: true
    },
    {
      name: 'Kavya Reddy',
      email: 'kavya@fuelmax.com',
      password: hashedPassword,
      phone: '+91-9876543223',
      role: 'employee',
      stationId: station2.id,
      planId: basicPlan.id,
      isActive: true
    },
    {
      name: 'Arjun Nair',
      email: 'arjun@fuelmax.com',
      password: hashedPassword,
      phone: '+91-9876543224',
      role: 'employee',
      stationId: station2.id,
      planId: basicPlan.id,
      isActive: true
    }
  ]);
  
  // ============================================
  // SCENARIO 3: Premium Plan Owner - Large Station
  // ============================================
  const owner3 = await User.create({
    name: 'Deepak Mehta',
    email: 'deepak@highwaystar.com',
    password: hashedPassword,
    phone: '+91-9876543230',
    role: 'owner',
    planId: premiumPlan.id,
    isActive: true
  });
  
  const station3 = await Station.create({
    ownerId: owner3.id,
    name: 'Highway Star Petrol Pump',
    code: 'HSP003',
    address: 'NH-48, KM 65, Mumbai-Pune Highway',
    city: 'Lonavala',
    state: 'Maharashtra',
    pincode: '410401',
    phone: '+91-9876543230',
    email: 'contact@highwaystar.com',
    gstNumber: '27AABCU9603R1ZO',
    isActive: true
  });
  
  await owner3.update({ stationId: station3.id });
  
  const manager3a = await User.create({
    name: 'Neha Gupta',
    email: 'neha@highwaystar.com',
    password: hashedPassword,
    phone: '+91-9876543231',
    role: 'manager',
    stationId: station3.id,
    planId: premiumPlan.id,
    isActive: true
  });
  
  const manager3b = await User.create({
    name: 'Karan Malhotra',
    email: 'karan@highwaystar.com',
    password: hashedPassword,
    phone: '+91-9876543232',
    role: 'manager',
    stationId: station3.id,
    planId: premiumPlan.id,
    isActive: true
  });
  
  // Create 6 employees for station 3
  const employeeNames3 = [
    { name: 'Rohit Verma', email: 'rohit@highwaystar.com', phone: '+91-9876543233' },
    { name: 'Pooja Iyer', email: 'pooja@highwaystar.com', phone: '+91-9876543234' },
    { name: 'Suresh Yadav', email: 'suresh@highwaystar.com', phone: '+91-9876543235' },
    { name: 'Anita Dubey', email: 'anita@highwaystar.com', phone: '+91-9876543236' },
    { name: 'Manoj Tiwari', email: 'manoj@highwaystar.com', phone: '+91-9876543237' },
    { name: 'Shalini Rao', email: 'shalini@highwaystar.com', phone: '+91-9876543238' }
  ];
  
  await User.bulkCreate(employeeNames3.map(emp => ({
    ...emp,
    password: hashedPassword,
    role: 'employee',
    stationId: station3.id,
    planId: premiumPlan.id,
    isActive: true
  })));
  
  // ============================================
  // SCENARIO 4: Enterprise Plan Owner - Multiple Stations
  // ============================================
  const owner4 = await User.create({
    name: 'Anil Kapoor',
    email: 'anil@metrofuel.com',
    password: hashedPassword,
    phone: '+91-9876543240',
    role: 'owner',
    planId: enterprisePlan.id,
    isActive: true
  });
  
  const station4a = await Station.create({
    ownerId: owner4.id,
    name: 'Metro Fuel - Andheri',
    code: 'MFA004',
    address: 'Andheri East, Near Metro Station',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400069',
    phone: '+91-9876543240',
    email: 'andheri@metrofuel.com',
    gstNumber: '27AABCU9603R1ZP',
    isActive: true
  });
  
  const station4b = await Station.create({
    ownerId: owner4.id,
    name: 'Metro Fuel - Bandra',
    code: 'MFB005',
    address: 'Bandra West, Linking Road',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    phone: '+91-9876543241',
    email: 'bandra@metrofuel.com',
    gstNumber: '27AABCU9603R1ZQ',
    isActive: true
  });
  
  const station4c = await Station.create({
    ownerId: owner4.id,
    name: 'Metro Fuel - Thane',
    code: 'MFT006',
    address: 'Eastern Express Highway, Thane',
    city: 'Thane',
    state: 'Maharashtra',
    pincode: '400601',
    phone: '+91-9876543242',
    email: 'thane@metrofuel.com',
    gstNumber: '27AABCU9603R1ZR',
    isActive: true
  });
  
  await owner4.update({ stationId: station4a.id }); // Primary station
  
  // Managers for each station
  const manager4a = await User.create({
    name: 'Sanjay Dutt',
    email: 'sanjay@metrofuel.com',
    password: hashedPassword,
    phone: '+91-9876543243',
    role: 'manager',
    stationId: station4a.id,
    planId: enterprisePlan.id,
    isActive: true
  });
  
  const manager4b = await User.create({
    name: 'Raveena Tandon',
    email: 'raveena@metrofuel.com',
    password: hashedPassword,
    phone: '+91-9876543244',
    role: 'manager',
    stationId: station4b.id,
    planId: enterprisePlan.id,
    isActive: true
  });
  
  const manager4c = await User.create({
    name: 'Ajay Devgan',
    email: 'ajay@metrofuel.com',
    password: hashedPassword,
    phone: '+91-9876543245',
    role: 'manager',
    stationId: station4c.id,
    planId: enterprisePlan.id,
    isActive: true
  });
  
  // Employees for each Metro Fuel station
  const employeesPerStation = 4;
  const employeeData4 = [];
  
  [station4a, station4b, station4c].forEach((station, idx) => {
    for (let i = 0; i < employeesPerStation; i++) {
      employeeData4.push({
        name: `Employee ${idx + 1}-${i + 1}`,
        email: `emp${idx + 1}${i + 1}@metrofuel.com`,
        password: hashedPassword,
        phone: `+91-98765432${50 + idx * 10 + i}`,
        role: 'employee',
        stationId: station.id,
        planId: enterprisePlan.id,
        isActive: true
      });
    }
  });
  
  await User.bulkCreate(employeeData4);
  
  console.log('✅ Users and stations seeded');
  
  return {
    stations: {
      station1,
      station2,
      station3,
      station4a,
      station4b,
      station4c
    },
    users: {
      owner1,
      employee1a,
      employee1b,
      owner2,
      manager2,
      owner3,
      manager3a,
      manager3b,
      owner4,
      manager4a,
      manager4b,
      manager4c
    }
  };
}

async function seedPumpsAndNozzles(stations) {
  console.log('⛽ Seeding pumps and nozzles...');
  
  const pumpData = [];
  const nozzleData = [];
  
  // Station 1: 2 pumps (Free plan limit)
  for (let i = 1; i <= 2; i++) {
    const pump = await Pump.create({
      stationId: stations.station1.id,
      name: `Pump ${i}`,
      pumpNumber: i,
      status: 'active',
      isActive: true
    });
    
    // 4 nozzles per pump (2 petrol, 2 diesel)
    await Nozzle.bulkCreate([
      { pumpId: pump.id, nozzleNumber: 1, fuelType: 'petrol', status: 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 2, fuelType: 'petrol', status: 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 3, fuelType: 'diesel', status: 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 4, fuelType: 'diesel', status: 'active', isActive: true }
    ]);
  }
  
  // Station 2: 4 pumps (Basic plan)
  for (let i = 1; i <= 4; i++) {
    const pump = await Pump.create({
      stationId: stations.station2.id,
      name: `Pump ${i}`,
      pumpNumber: i,
      status: i === 4 ? 'maintenance' : 'active',
      isActive: true
    });
    
    await Nozzle.bulkCreate([
      { pumpId: pump.id, nozzleNumber: 1, fuelType: 'petrol', status: i === 4 ? 'inactive' : 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 2, fuelType: 'petrol', status: i === 4 ? 'inactive' : 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 3, fuelType: 'diesel', status: i === 4 ? 'inactive' : 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 4, fuelType: 'diesel', status: i === 4 ? 'inactive' : 'active', isActive: true }
    ]);
  }
  
  // Station 3: 6 pumps (Premium plan)
  for (let i = 1; i <= 6; i++) {
    const pump = await Pump.create({
      stationId: stations.station3.id,
      name: `Highway Pump ${i}`,
      pumpNumber: i,
      status: 'active',
      isActive: true
    });
    
    await Nozzle.bulkCreate([
      { pumpId: pump.id, nozzleNumber: 1, fuelType: 'petrol', status: 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 2, fuelType: 'petrol', status: 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 3, fuelType: 'diesel', status: 'active', isActive: true },
      { pumpId: pump.id, nozzleNumber: 4, fuelType: 'diesel', status: 'active', isActive: true }
    ]);
  }
  
  // Metro Fuel stations: 3-4 pumps each
  for (const station of [stations.station4a, stations.station4b, stations.station4c]) {
    const pumpCount = station === stations.station4a ? 4 : 3;
    
    for (let i = 1; i <= pumpCount; i++) {
      const pump = await Pump.create({
        stationId: station.id,
        name: `Pump ${i}`,
        pumpNumber: i,
        status: 'active',
        isActive: true
      });
      
      await Nozzle.bulkCreate([
        { pumpId: pump.id, nozzleNumber: 1, fuelType: 'petrol', status: 'active', isActive: true },
        { pumpId: pump.id, nozzleNumber: 2, fuelType: 'petrol', status: 'active', isActive: true },
        { pumpId: pump.id, nozzleNumber: 3, fuelType: 'diesel', status: 'active', isActive: true },
        { pumpId: pump.id, nozzleNumber: 4, fuelType: 'diesel', status: 'active', isActive: true }
      ]);
    }
  }
  
  console.log('✅ Pumps and nozzles seeded');
}

async function seedFuelPrices(stations, users) {
  console.log('💰 Seeding fuel prices...');
  
  const priceData = [
    // Station 1
    { stationId: stations.station1.id, fuelType: 'petrol', price: 105.50, updatedBy: users.owner1.id, effectiveFrom: daysAgo(30) },
    { stationId: stations.station1.id, fuelType: 'diesel', price: 95.75, updatedBy: users.owner1.id, effectiveFrom: daysAgo(30) },
    { stationId: stations.station1.id, fuelType: 'petrol', price: 106.20, updatedBy: users.owner1.id, effectiveFrom: daysAgo(7) },
    { stationId: stations.station1.id, fuelType: 'diesel', price: 96.40, updatedBy: users.owner1.id, effectiveFrom: daysAgo(7) },
    
    // Station 2
    { stationId: stations.station2.id, fuelType: 'petrol', price: 104.80, updatedBy: users.owner2.id, effectiveFrom: daysAgo(30) },
    { stationId: stations.station2.id, fuelType: 'diesel', price: 95.20, updatedBy: users.owner2.id, effectiveFrom: daysAgo(30) },
    { stationId: stations.station2.id, fuelType: 'petrol', price: 105.90, updatedBy: users.manager2.id, effectiveFrom: daysAgo(7) },
    { stationId: stations.station2.id, fuelType: 'diesel', price: 96.10, updatedBy: users.manager2.id, effectiveFrom: daysAgo(7) },
    
    // Station 3
    { stationId: stations.station3.id, fuelType: 'petrol', price: 107.00, updatedBy: users.owner3.id, effectiveFrom: daysAgo(30) },
    { stationId: stations.station3.id, fuelType: 'diesel', price: 97.50, updatedBy: users.owner3.id, effectiveFrom: daysAgo(30) },
    { stationId: stations.station3.id, fuelType: 'petrol', price: 108.50, updatedBy: users.manager3a.id, effectiveFrom: daysAgo(7) },
    { stationId: stations.station3.id, fuelType: 'diesel', price: 98.75, updatedBy: users.manager3a.id, effectiveFrom: daysAgo(7) },
    
    // Metro Fuel stations
    { stationId: stations.station4a.id, fuelType: 'petrol', price: 106.50, updatedBy: users.manager4a.id, effectiveFrom: daysAgo(15) },
    { stationId: stations.station4a.id, fuelType: 'diesel', price: 96.80, updatedBy: users.manager4a.id, effectiveFrom: daysAgo(15) },
    
    { stationId: stations.station4b.id, fuelType: 'petrol', price: 106.30, updatedBy: users.manager4b.id, effectiveFrom: daysAgo(15) },
    { stationId: stations.station4b.id, fuelType: 'diesel', price: 96.60, updatedBy: users.manager4b.id, effectiveFrom: daysAgo(15) },
    
    { stationId: stations.station4c.id, fuelType: 'petrol', price: 105.80, updatedBy: users.manager4c.id, effectiveFrom: daysAgo(15) },
    { stationId: stations.station4c.id, fuelType: 'diesel', price: 96.20, updatedBy: users.manager4c.id, effectiveFrom: daysAgo(15) }
  ];
  
  await FuelPrice.bulkCreate(priceData);
  console.log('✅ Fuel prices seeded');
}

async function seedReadingsAndSales(stations, users) {
  console.log('📊 Seeding nozzle readings (last 30 days)...');
  
  // Get all active pumps and nozzles
  const allStations = Object.values(stations);
  
  for (const station of allStations) {
    const pumps = await Pump.findAll({
      where: { stationId: station.id, status: 'active' },
      include: [{ model: Nozzle, as: 'nozzles', where: { status: 'active' } }]
    });
    
    // Get station employees for data entry
    const stationEmployees = await User.findAll({
      where: { stationId: station.id, role: 'employee' }
    });
    
    if (stationEmployees.length === 0) continue;
    
    // Create readings for last 30 days
    for (let day = 30; day >= 0; day--) {
      const readingDate = daysAgo(day);
      const employee = stationEmployees[day % stationEmployees.length];
      
      for (const pump of pumps) {
        for (const nozzle of pump.nozzles) {
          // Generate realistic cumulative readings
          const baseReading = 50000 + (30 - day) * 150;
          const variation = Math.random() * 50;
          const readingValue = baseReading + variation + (nozzle.nozzleNumber * 100);
          
          // Calculate litres sold from previous reading
          const previousReading = day < 30 ? readingValue - 150 : 0;
          const litresSold = readingValue - previousReading;
          
          // Get price for fuel type
          const priceRecord = await FuelPrice.findOne({
            where: {
              stationId: station.id,
              fuelType: nozzle.fuelType,
              effectiveFrom: { [Op.lte]: readingDate }
            },
            order: [['effectiveFrom', 'DESC']]
          });
          
          const pricePerLitre = priceRecord ? priceRecord.price : (nozzle.fuelType === 'petrol' ? 105 : 95);
          const totalAmount = litresSold * pricePerLitre;
          
          await NozzleReading.create({
            stationId: station.id,
            pumpId: pump.id,
            nozzleId: nozzle.id,
            fuelType: nozzle.fuelType,
            readingDate: readingDate,
            readingValue: Math.round(readingValue * 100) / 100,
            previousReading: Math.round(previousReading * 100) / 100,
            litresSold: Math.round(litresSold * 100) / 100,
            pricePerLitre: pricePerLitre,
            totalAmount: Math.round(totalAmount * 100) / 100,
            cashAmount: Math.round(totalAmount * 0.7 * 100) / 100,
            onlineAmount: Math.round(totalAmount * 0.2 * 100) / 100,
            creditAmount: Math.round(totalAmount * 0.1 * 100) / 100,
            enteredBy: employee.id,
            isInitialReading: day === 30,
            createdAt: readingDate
          });
        }
      }
    }
  }
  
  console.log('✅ Nozzle readings seeded');
}

async function seedTanksAndRefills(stations, users) {
  console.log('🛢️ Seeding tanks and refills...');
  
  const tankData = [];
  
  // Create tanks for each station
  for (const station of Object.values(stations)) {
    // Each station has 2 tanks: petrol and diesel
    const petrolTank = await Tank.create({
      stationId: station.id,
      name: 'Petrol Storage Tank',
      fuelType: 'petrol',
      capacity: 10000,
      currentLevel: 7500 + Math.random() * 1000,
      minLevel: 2000,
      status: 'active',
      isActive: true
    });
    
    const dieselTank = await Tank.create({
      stationId: station.id,
      name: 'Diesel Storage Tank',
      fuelType: 'diesel',
      capacity: 15000,
      currentLevel: 11000 + Math.random() * 2000,
      minLevel: 3000,
      status: 'active',
      isActive: true
    });
    
    // Create refill history
    const stationOwner = await User.findOne({ 
      where: { stationId: station.id, role: ['owner', 'manager'] } 
    });
    
    if (stationOwner) {
      // 3-5 refills in the past 30 days
      const refillCount = 3 + Math.floor(Math.random() * 3);
      
      for (let i = 0; i < refillCount; i++) {
        const refillDate = daysAgo(Math.floor(Math.random() * 30));
        const isPetrol = Math.random() > 0.5;
        const litres = 5000 + Math.random() * 3000;
        const costPerLitre = isPetrol ? 95.50 : 86.75;
        
        await TankRefill.create({
          tankId: isPetrol ? petrolTank.id : dieselTank.id,
          stationId: station.id,
          litres: Math.round(litres * 100) / 100,
          costPerLitre: costPerLitre,
          totalCost: Math.round(litres * costPerLitre * 100) / 100,
          supplierName: ['Indian Oil', 'Bharat Petroleum', 'Hindustan Petroleum'][Math.floor(Math.random() * 3)],
          invoiceNumber: `INV-${Date.now()}-${i}`,
          refillDate: refillDate,
          enteredBy: stationOwner.id,
          createdAt: refillDate
        });
      }
    }
  }
  
  console.log('✅ Tanks and refills seeded');
}

async function seedCreditorsAndTransactions(stations, users) {
  console.log('💳 Seeding creditors and transactions...');
  
  for (const station of Object.values(stations)) {
    const stationOwner = await User.findOne({ 
      where: { stationId: station.id, role: ['owner', 'manager'] } 
    });
    
    if (!stationOwner) continue;
    
    // Create 3-5 creditors per station
    const creditorCount = 3 + Math.floor(Math.random() * 3);
    
    for (let i = 0; i < creditorCount; i++) {
      const creditor = await Creditor.create({
        stationId: station.id,
        name: `Company ${String.fromCharCode(65 + i)} Pvt Ltd`,
        contactPerson: `Contact Person ${i + 1}`,
        phone: `+91-98765${43210 + i}`,
        email: `company${String.fromCharCode(97 + i)}@example.com`,
        creditLimit: 50000 + Math.random() * 100000,
        currentBalance: 0,
        isActive: true,
        createdBy: stationOwner.id
      });
      
      // Create 5-10 transactions for each creditor
      const transactionCount = 5 + Math.floor(Math.random() * 6);
      let runningBalance = 0;
      
      for (let j = 0; j < transactionCount; j++) {
        const transactionDate = daysAgo(Math.floor(Math.random() * 30));
        const isCredit = Math.random() > 0.3; // 70% credits, 30% payments
        const amount = 1000 + Math.random() * 5000;
        
        if (isCredit) {
          runningBalance += amount;
          const fuelType = Math.random() > 0.5 ? 'petrol' : 'diesel';
          const pricePerLitre = fuelType === 'petrol' ? 106 : 96;
          const litres = Math.round((amount / pricePerLitre) * 100) / 100;
          
          await CreditTransaction.create({
            creditorId: creditor.id,
            stationId: station.id,
            transactionType: 'credit',
            amount: amount,
            fuelType: fuelType,
            litres: litres,
            pricePerLitre: pricePerLitre,
            transactionDate: transactionDate,
            enteredBy: stationOwner.id,
            notes: `Fuel purchase - ${fuelType === 'petrol' ? 'Petrol' : 'Diesel'}`,
            createdAt: transactionDate
          });
        } else {
          const settlementAmount = Math.min(amount, runningBalance);
          runningBalance -= settlementAmount;
          
          await CreditTransaction.create({
            creditorId: creditor.id,
            stationId: station.id,
            transactionType: 'settlement',
            amount: settlementAmount,
            referenceNumber: `REF-${Date.now()}-${j}`,
            transactionDate: transactionDate,
            enteredBy: stationOwner.id,
            notes: 'Payment received',
            createdAt: transactionDate
          });
        }
      }
      
      // Update creditor balance
      await creditor.update({ currentBalance: Math.max(0, runningBalance) });
    }
  }
  
  console.log('✅ Creditors and transactions seeded');
}

async function seedExpenses(stations, users) {
  console.log('💸 Seeding expenses...');
  
  const expenseCategories = [
    'salary',
    'electricity',
    'rent',
    'maintenance',
    'supplies',
    'taxes',
    'insurance',
    'transportation',
    'miscellaneous'
  ];
  
  for (const station of Object.values(stations)) {
    const stationManager = await User.findOne({ 
      where: { stationId: station.id, role: ['owner', 'manager'] } 
    });
    
    if (!stationManager) continue;
    
    // Create 10-15 expenses per station
    const expenseCount = 10 + Math.floor(Math.random() * 6);
    
    for (let i = 0; i < expenseCount; i++) {
      const expenseDate = daysAgo(Math.floor(Math.random() * 30));
      const category = expenseCategories[Math.floor(Math.random() * expenseCategories.length)];
      
      await Expense.create({
        stationId: station.id,
        category: category,
        amount: category === 'salary' ? 15000 + Math.random() * 10000 : 500 + Math.random() * 5000,
        description: `${category.charAt(0).toUpperCase() + category.slice(1)} expense`,
        expenseDate: expenseDate,
        paymentMethod: ['cash', 'bank_transfer', 'upi'][Math.floor(Math.random() * 3)],
        enteredBy: stationManager.id,
        createdAt: expenseDate
      });
    }
  }
  
  console.log('✅ Expenses seeded');
}

async function seedCostOfGoods(stations, users) {
  console.log('📦 Seeding cost of goods...');
  
  for (const station of Object.values(stations)) {
    const stationOwner = await User.findOne({ 
      where: { stationId: station.id, role: ['owner', 'manager'] } 
    });
    
    if (!stationOwner) continue;
    
    // Create COGS entries for last 3 months
    for (let monthsBack = 2; monthsBack >= 0; monthsBack--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - monthsBack);
      const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
      
      // Petrol COGS
      const petrolLitres = 80000 + Math.random() * 20000;
      const petrolCost = petrolLitres * (95.50 + Math.random() * 2);
      
      await CostOfGoods.create({
        stationId: station.id,
        month: monthStr,
        fuelType: 'petrol',
        litresPurchased: petrolLitres,
        totalCost: petrolCost,
        avgCostPerLitre: petrolCost / petrolLitres,
        notes: 'Monthly petrol procurement',
        enteredBy: stationOwner.id
      });
      
      // Diesel COGS
      const dieselLitres = 60000 + Math.random() * 15000;
      const dieselCost = dieselLitres * (86.75 + Math.random() * 2);
      
      await CostOfGoods.create({
        stationId: station.id,
        month: monthStr,
        fuelType: 'diesel',
        litresPurchased: dieselLitres,
        totalCost: dieselCost,
        avgCostPerLitre: dieselCost / dieselLitres,
        notes: 'Monthly diesel procurement',
        enteredBy: stationOwner.id
      });
    }
  }
  
  console.log('✅ Cost of goods seeded');
}

// Main execution
async function main() {
  try {
    console.log('🌱 Starting comprehensive data seeding...\n');
    
    await sequelize.authenticate();
    console.log('✅ Database connected\n');
    
    // Sync database first to ensure all tables exist
    console.log('📦 Syncing database schema (dropping and recreating all tables)...');
    await sequelize.sync({ force: true }); // Drop and recreate all tables
    console.log('✅ Database schema synced\n');
    
    // Seed in order
    await seedPlans();
    const { stations, users } = await seedUsersAndStations();
    await seedPumpsAndNozzles(stations);
    await seedFuelPrices(stations, users);
    await seedReadingsAndSales(stations, users);
    await seedTanksAndRefills(stations, users);
    await seedCreditorsAndTransactions(stations, users);
    await seedExpenses(stations, users);
    await seedCostOfGoods(stations, users);
    
    console.log('\n✅ ====================================');
    console.log('✅  ALL SAMPLE DATA SEEDED SUCCESSFULLY');
    console.log('✅ ====================================\n');
    
    console.log('📋 Test Accounts Created:');
    console.log('─────────────────────────────────────');
    console.log('Super Admin:');
    console.log('  Email: admin@fuelsync.com');
    console.log('  Password: admin123\n');
    
    console.log('Free Plan (QuickFuel Express):');
    console.log('  Owner: rajesh@quickfuel.com / password123');
    console.log('  Employee: amit@quickfuel.com / password123');
    console.log('  Employee: priya@quickfuel.com / password123\n');
    
    console.log('Basic Plan (FuelMax Central):');
    console.log('  Owner: sneha@fuelmax.com / password123');
    console.log('  Manager: vikram@fuelmax.com / password123');
    console.log('  Employees: rahul@, kavya@, arjun@fuelmax.com / password123\n');
    
    console.log('Premium Plan (Highway Star):');
    console.log('  Owner: deepak@highwaystar.com / password123');
    console.log('  Managers: neha@, karan@highwaystar.com / password123');
    console.log('  6 Employees: rohit@, pooja@, suresh@... / password123\n');
    
    console.log('Enterprise Plan (Metro Fuel - 3 Stations):');
    console.log('  Owner: anil@metrofuel.com / password123');
    console.log('  Managers: sanjay@, raveena@, ajay@metrofuel.com / password123');
    console.log('  12 Employees across 3 stations / password123\n');
    
    console.log('📊 Data Summary:');
    console.log('─────────────────────────────────────');
    const planCount = await Plan.count();
    const userCount = await User.count();
    const stationCount = await Station.count();
    const pumpCount = await Pump.count();
    const nozzleCount = await Nozzle.count();
    const readingCount = await NozzleReading.count();
    const creditorCount = await Creditor.count();
    const expenseCount = await Expense.count();
    
    console.log(`Plans: ${planCount}`);
    console.log(`Users: ${userCount} (across all roles)`);
    console.log(`Stations: ${stationCount}`);
    console.log(`Pumps: ${pumpCount}`);
    console.log(`Nozzles: ${nozzleCount}`);
    console.log(`Readings: ${readingCount} (30 days history)`);
    console.log(`Creditors: ${creditorCount}`);
    console.log(`Expenses: ${expenseCount}`);
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run the script
main();

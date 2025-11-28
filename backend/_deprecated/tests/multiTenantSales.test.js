
const { sequelize } = require('../config/database');
const { Station, User, Pump, Nozzle, FuelPrice, OCRReading, Sale } = require('../models/multiTenantIndex');
const MultiTenantSalesService = require('../services/multiTenantSalesService');

describe('Multi-Tenant Sales Service', () => {
  let testStation, testUser, testPump, testNozzle, testFuelPrice;
  
  beforeAll(async () => {
    await sequelize.sync({ force: true });
    
    // Create test data
    testStation = await Station.create({
      name: 'Test Station',
      location: 'Test Location'
    });
    
    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'password',
      role: 'employee',
      stationId: testStation.id
    });
    
    testPump = await Pump.create({
      stationId: testStation.id,
      pumpSno: 'TEST001',
      name: 'Test Pump',
      status: 'active'
    });
    
    testNozzle = await Nozzle.create({
      pumpId: testPump.id,
      nozzleId: 1,
      fuelType: 'petrol',
      status: 'active'
    });
    
    testFuelPrice = await FuelPrice.create({
      stationId: testStation.id,
      fuelType: 'petrol',
      price: 100.00,
      updatedBy: testUser.id
    });
  });
  
  afterAll(async () => {
    await sequelize.close();
  });
  
  describe('Sales Calculation', () => {
    test('should calculate sales correctly from two readings', async () => {
      // Create first reading (baseline)
      const firstReading = await OCRReading.create({
        stationId: testStation.id,
        pumpId: testPump.id,
        nozzleId: 1,
        pumpSno: 'TEST001',
        fuelType: 'petrol',
        cumulativeVolume: 1000.000,
        readingDate: '2024-06-01',
        readingTime: '08:00:00',
        enteredBy: testUser.id
      });
      
      // Create second reading
      const secondReading = await OCRReading.create({
        stationId: testStation.id,
        pumpId: testPump.id,
        nozzleId: 1,
        pumpSno: 'TEST001',
        fuelType: 'petrol',
        cumulativeVolume: 1050.500,
        readingDate: '2024-06-02',
        readingTime: '08:00:00',
        enteredBy: testUser.id
      });
      
      // Calculate sales
      const salesData = await MultiTenantSalesService.calculateSaleFromReading(secondReading);
      
      expect(salesData).not.toBeNull();
      expect(salesData.litresSold).toBe(50.5);
      expect(salesData.pricePerLitre).toBe(100.00);
      expect(salesData.totalAmount).toBe(5050.00);
      expect(salesData.previousReadingId).toBe(firstReading.id);
    });
    
    test('should return null for first reading (no previous)', async () => {
      // Create isolated reading
      const isolatedReading = await OCRReading.create({
        stationId: testStation.id,
        pumpId: testPump.id,
        nozzleId: 2,
        pumpSno: 'TEST001',
        fuelType: 'petrol',
        cumulativeVolume: 500.000,
        readingDate: '2024-06-01',
        readingTime: '08:00:00',
        enteredBy: testUser.id
      });
      
      const salesData = await MultiTenantSalesService.calculateSaleFromReading(isolatedReading);
      expect(salesData).toBeNull();
    });
    
    test('should handle negative litres (meter reset)', async () => {
      // Create reading with lower cumulative volume (meter reset scenario)
      const resetReading = await OCRReading.create({
        stationId: testStation.id,
        pumpId: testPump.id,
        nozzleId: 3,
        pumpSno: 'TEST001',
        fuelType: 'petrol',
        cumulativeVolume: 100.000,
        readingDate: '2024-06-01',
        readingTime: '08:00:00',
        enteredBy: testUser.id
      });
      
      const lowerReading = await OCRReading.create({
        stationId: testStation.id,
        pumpId: testPump.id,
        nozzleId: 3,
        pumpSno: 'TEST001',
        fuelType: 'petrol',
        cumulativeVolume: 50.000,
        readingDate: '2024-06-02',
        readingTime: '08:00:00',
        enteredBy: testUser.id
      });
      
      const salesData = await MultiTenantSalesService.calculateSaleFromReading(lowerReading);
      expect(salesData).toBeNull(); // Should return null for negative sales
    });
  });
  
  describe('Station Isolation', () => {
    test('should only consider readings from same station', async () => {
      // Create another station with same pump number
      const otherStation = await Station.create({
        name: 'Other Station',
        location: 'Other Location'
      });
      
      const otherUser = await User.create({
        name: 'Other User',
        email: 'other@example.com',
        password: 'password',
        role: 'employee',
        stationId: otherStation.id
      });
      
      const otherPump = await Pump.create({
        stationId: otherStation.id,
        pumpSno: 'TEST001', // Same pump serial number
        name: 'Other Pump',
        status: 'active'
      });
      
      const otherNozzle = await Nozzle.create({
        pumpId: otherPump.id,
        nozzleId: 1,
        fuelType: 'petrol',
        status: 'active'
      });
      
      const otherFuelPrice = await FuelPrice.create({
        stationId: otherStation.id,
        fuelType: 'petrol',
        price: 105.00,
        updatedBy: otherUser.id
      });
      
      // Create reading in other station
      await OCRReading.create({
        stationId: otherStation.id,
        pumpId: otherPump.id,
        nozzleId: 1,
        pumpSno: 'TEST001',
        fuelType: 'petrol',
        cumulativeVolume: 2000.000,
        readingDate: '2024-06-01',
        readingTime: '08:00:00',
        enteredBy: otherUser.id
      });
      
      // Create reading in original station
      const testReading = await OCRReading.create({
        stationId: testStation.id,
        pumpId: testPump.id,
        nozzleId: 4,
        pumpSno: 'TEST001',
        fuelType: 'petrol',
        cumulativeVolume: 1100.000,
        readingDate: '2024-06-02',
        readingTime: '08:00:00',
        enteredBy: testUser.id
      });
      
      // Should not find previous reading from other station
      const salesData = await MultiTenantSalesService.calculateSaleFromReading(testReading);
      expect(salesData).toBeNull();
    });
  });
  
  describe('Pump and Nozzle Auto-Creation', () => {
    test('should create pump and nozzles if they do not exist', async () => {
      const newPumpSno = 'AUTO001';
      const nozzleIds = [1, 2, 3, 4];
      
      // Ensure pump doesn't exist
      const existingPump = await Pump.findOne({
        where: { stationId: testStation.id, pumpSno: newPumpSno }
      });
      expect(existingPump).toBeNull();
      
      // Auto-create pump and nozzles
      const createdPump = await MultiTenantSalesService.ensurePumpAndNozzlesExist(
        testStation.id,
        newPumpSno,
        nozzleIds,
        testUser.id
      );
      
      expect(createdPump).not.toBeNull();
      expect(createdPump.pumpSno).toBe(newPumpSno);
      
      // Check nozzles were created
      const nozzles = await Nozzle.findAll({
        where: { pumpId: createdPump.id }
      });
      
      expect(nozzles).toHaveLength(4);
      expect(nozzles.map(n => n.nozzleId).sort()).toEqual([1, 2, 3, 4]);
      
      // Check fuel type mapping
      const petrolNozzles = nozzles.filter(n => n.fuelType === 'petrol');
      const dieselNozzles = nozzles.filter(n => n.fuelType === 'diesel');
      
      expect(petrolNozzles).toHaveLength(2); // Nozzles 1, 2
      expect(dieselNozzles).toHaveLength(2);  // Nozzles 3, 4
    });
  });
  
  describe('Sales Summary', () => {
    test('should calculate station sales summary correctly', async () => {
      // Create some sales data
      await Sale.create({
        stationId: testStation.id,
        pumpId: testPump.id,
        nozzleId: 1,
        readingId: (await OCRReading.findOne()).id,
        fuelType: 'petrol',
        litresSold: 25.5,
        pricePerLitre: 100.00,
        totalAmount: 2550.00,
        saleDate: '2024-06-01',
        shift: 'morning',
        createdBy: testUser.id
      });
      
      await Sale.create({
        stationId: testStation.id,
        pumpId: testPump.id,
        nozzleId: 1,
        readingId: (await OCRReading.findOne()).id,
        fuelType: 'petrol',
        litresSold: 30.0,
        pricePerLitre: 100.00,
        totalAmount: 3000.00,
        saleDate: '2024-06-01',
        shift: 'afternoon',
        createdBy: testUser.id
      });
      
      const summary = await MultiTenantSalesService.getStationSalesSummary(
        testStation.id,
        '2024-06-01',
        '2024-06-01'
      );
      
      expect(summary.petrol.totalLitres).toBe(55.5);
      expect(summary.petrol.totalRevenue).toBe(5550.00);
      expect(summary.petrol.totalTransactions).toBe(2);
      expect(summary.grandTotal.totalLitres).toBe(55.5);
      expect(summary.grandTotal.totalRevenue).toBe(5550.00);
      expect(summary.grandTotal.totalTransactions).toBe(2);
    });
  });
});

/**
 * Station Routes
 * Includes Pumps, Nozzles, Fuel Prices, Staff, Tanks, and Shifts Management
 */

const express = require('express');
const router = express.Router();

// ===== DOMAIN CONTROLLERS =====
const stationManagementController = require('../controllers/stationManagementController');
const stationController = require('../controllers/stationController');
const deviceController = require('../controllers/deviceController');
const fuelPricingController = require('../controllers/fuelPricingController');
const stationReportingController = require('../controllers/stationReportingController');

// ===== OTHER CONTROLLERS =====
const userController = require('../controllers/userController');
const tankController = require('../controllers/tankController');
const shiftController = require('../controllers/shiftController');

// ===== MIDDLEWARE =====
const { authenticate, requireRole, requireMinRole } = require('../middleware/auth');
const { validate, stationValidators, pumpValidators, tankValidators } = require('../validators');
const { enforcePlanLimit } = require('../middleware/planLimits');

// All routes require authentication
router.use(authenticate);

// ============================================
// STATIONS
// ============================================
router.get('/', stationManagementController.getStations);
router.post('/', 
  requireRole(['owner', 'super_admin']),
  enforcePlanLimit('station'), // Check plan limits before creation
  validate(stationValidators.create),
  stationManagementController.createStation
);
router.get('/:id', stationManagementController.getStation);
router.put('/:id', 
  requireRole(['owner', 'super_admin']), 
  validate(stationValidators.update),
  stationManagementController.updateStation
);

// ============================================
// STATION SETTINGS
// ============================================
router.get('/:id/settings', stationManagementController.getStationSettings);
router.put('/:id/settings', 
  requireRole(['owner', 'super_admin']), 
  stationManagementController.updateStationSettings
);

// ============================================
// STATION STAFF
// ============================================
router.get('/:stationId/staff', userController.getStationStaff);
router.get('/:stationId/employees', userController.getStationStaff);  // Alias for /staff

// ============================================
// PUMPS (nested under stations)
// ============================================
router.get('/:stationId/pumps', deviceController.getPumps);
router.post('/:stationId/pumps', 
  requireRole(['owner', 'super_admin']),
  validate(pumpValidators.create), // Validate pump creation
  enforcePlanLimit('pump'), // Check plan limits before creation
  deviceController.createPump
);
router.put('/pumps/:id', requireRole(['owner', 'super_admin']), deviceController.updatePump);
router.delete('/pumps/:id', requireRole(['owner', 'super_admin']), deviceController.deletePump);

// ============================================
// NOZZLES (nested under pumps)
// ============================================
router.get('/pumps/:pumpId/nozzles', deviceController.getNozzles);
router.get('/:stationId/nozzles', deviceController.getNozzles);  // Alias for station-level query
router.get('/nozzles/:id', deviceController.getNozzle);
router.post('/pumps/:pumpId/nozzles', 
  requireRole(['owner', 'super_admin']),
  enforcePlanLimit('nozzle'), // Check plan limits before creation
  deviceController.createNozzle
);
router.put('/nozzles/:id', requireRole(['owner', 'super_admin']), deviceController.updateNozzle);
router.delete('/nozzles/:id', requireRole(['owner', 'super_admin']), deviceController.deleteNozzle);

// ============================================
// FUEL PRICES
// ============================================
router.get('/:stationId/prices', fuelPricingController.getFuelPrices);
router.get('/:stationId/prices/check', fuelPricingController.checkPriceSet);
router.post('/:stationId/prices', requireMinRole('manager'), fuelPricingController.setFuelPrice);

// ============================================
// TANKS (nested under stations)
// ============================================
router.get('/:stationId/tanks', tankController.getTanks);
router.post('/:stationId/tanks', 
  requireMinRole('manager'),
  validate(tankValidators.create),
  tankController.createTank
);
router.get('/:stationId/refills/summary', tankController.getRefillSummary);

// ============================================
// SHIFTS (nested under stations)
// ============================================
router.get('/:stationId/shifts', shiftController.getStationShifts);
router.get('/:stationId/shifts/summary', shiftController.getShiftSummary);
router.get('/:stationId/shifts/discrepancies', requireMinRole('manager'), shiftController.getDiscrepancies);

// ============================================
// CASH HANDOVERS (nested under stations)
// ============================================

// ============================================
// DAILY SALES & SETTLEMENTS
// ============================================
router.get('/:stationId/readings', requireMinRole('manager'), stationManagementController.getStationReadings);
router.get('/:stationId/daily-sales', stationReportingController.getDailySales);
router.get('/:stationId/readings-for-settlement', requireMinRole('manager'), stationReportingController.getReadingsForSettlement);
router.get('/:stationId/variance-summary', requireMinRole('manager'), stationController.getVarianceSummary);
router.get('/:stationId/settlements', requireMinRole('manager'), stationController.getSettlements);
router.get('/:stationId/employee-shortfalls', requireMinRole('manager'), stationController.getEmployeeShortfalls);

module.exports = router;

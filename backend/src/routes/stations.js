/**
 * Station Routes
 * Includes Pumps, Nozzles, Fuel Prices, Staff, Tanks, and Shifts Management
 */

const express = require('express');
const router = express.Router();
const stationController = require('../controllers/stationController');
const userController = require('../controllers/userController');
const tankController = require('../controllers/tankController');
const shiftController = require('../controllers/shiftController');
const cashHandoverController = require('../controllers/cashHandoverController');
const { authenticate, requireRole, requireMinRole } = require('../middleware/auth');
const { validate, stationValidators, pumpValidators, tankValidators } = require('../validators');
const { enforcePlanLimit } = require('../middleware/planLimits');

// All routes require authentication
router.use(authenticate);

// ============================================
// STATIONS
// ============================================
router.get('/', stationController.getStations);
router.post('/', 
  requireRole(['owner', 'super_admin']),
  enforcePlanLimit('station'), // Check plan limits before creation
  validate(stationValidators.create),
  stationController.createStation
);
router.get('/:id', stationController.getStation);
router.put('/:id', 
  requireRole(['owner', 'super_admin']), 
  validate(stationValidators.update),
  stationController.updateStation
);

// ============================================
// STATION SETTINGS
// ============================================
router.get('/:id/settings', stationController.getStationSettings);
router.put('/:id/settings', 
  requireRole(['owner', 'super_admin']), 
  stationController.updateStationSettings
);

// ============================================
// STATION STAFF
// ============================================
router.get('/:stationId/staff', userController.getStationStaff);

// ============================================
// PUMPS (nested under stations)
// ============================================
router.get('/:stationId/pumps', stationController.getPumps);
router.post('/:stationId/pumps', 
  requireRole(['owner', 'super_admin']),
  validate(pumpValidators.create), // Validate pump creation
  enforcePlanLimit('pump'), // Check plan limits before creation
  stationController.createPump
);
router.put('/pumps/:id', requireRole(['owner', 'super_admin']), stationController.updatePump);

// ============================================
// NOZZLES (nested under pumps)
// ============================================
router.get('/pumps/:pumpId/nozzles', stationController.getNozzles);
router.post('/pumps/:pumpId/nozzles', 
  requireRole(['owner', 'super_admin']),
  enforcePlanLimit('nozzle'), // Check plan limits before creation
  stationController.createNozzle
);
router.put('/nozzles/:id', requireRole(['owner', 'super_admin']), stationController.updateNozzle);

// ============================================
// FUEL PRICES
// ============================================
router.get('/:stationId/prices', stationController.getFuelPrices);
router.get('/:stationId/prices/check', stationController.checkPriceSet);
router.post('/:stationId/prices', requireMinRole('manager'), stationController.setFuelPrice);

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
router.get('/:stationId/handovers', cashHandoverController.getStationHandovers);
router.get('/:stationId/handovers/summary', cashHandoverController.getCashFlowSummary);
router.get('/:stationId/handovers/unconfirmed', cashHandoverController.getUnconfirmed);
router.get('/:stationId/handovers/bank-deposits', requireMinRole('owner'), cashHandoverController.getBankDeposits);

module.exports = router;

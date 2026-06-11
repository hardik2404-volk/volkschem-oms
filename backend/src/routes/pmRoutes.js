// ============================================================================
// VOLKSCHEM OMS — PM Routes
// ============================================================================

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { allowAdmin, allowAdminAndEmployee } = require('../middleware/roleGuard');
const pmController = require('../controllers/pmController');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/pms/inventory/:customerId/:productId/:packSize?packType=...&requiredPcs=...
router.get('/inventory/:customerId/:productId/:packSize', allowAdminAndEmployee, pmController.getPMStock);

// POST /api/v1/pms/inventory
router.post('/inventory', allowAdminAndEmployee, pmController.addBatch);

// GET /api/v1/pms/customer/:customerId
router.get('/customer/:customerId', allowAdminAndEmployee, pmController.getCustomerPMInventory);

module.exports = router;

// ============================================================================
// VOLKSCHEM OMS — Label Routes
// ============================================================================

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { allowAdmin, allowAdminAndEmployee } = require('../middleware/roleGuard');
const labelController = require('../controllers/labelController');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// GET /api/v1/labels/inventory/:customerId/:productId/:packSize?packType=...&requiredPcs=...
router.get('/inventory/:customerId/:productId/:packSize', allowAdminAndEmployee, labelController.getLabelStock);

// POST /api/v1/labels/inventory
router.post('/inventory', allowAdminAndEmployee, labelController.addBatch);

// GET /api/v1/labels/customer/:customerId
router.get('/customer/:customerId', allowAdminAndEmployee, labelController.getCustomerLabelInventory);

module.exports = router;

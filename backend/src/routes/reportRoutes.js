const express = require('express');
const { authenticate } = require('../middleware/auth');
const { allowAdmin } = require('../middleware/roleGuard');
const reportController = require('../controllers/reportController');

const router = express.Router();

router.use(authenticate);
router.get('/orders-excel', allowAdmin, reportController.downloadOrdersExcel);

module.exports = router;

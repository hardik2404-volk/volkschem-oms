const express = require('express');
const { authenticate } = require('../middleware/auth');
const customerController = require('../controllers/customerController');
const { allowAdminAndEmployee } = require('../middleware/roleGuard');

const router = express.Router();

router.use(authenticate);

router.get('/', allowAdminAndEmployee, customerController.getAll);
router.get('/:id', allowAdminAndEmployee, customerController.getById);
router.get('/:id/history', allowAdminAndEmployee, customerController.getHistory);
router.post('/', allowAdminAndEmployee, customerController.create);
router.put('/:id', allowAdminAndEmployee, customerController.update);
router.delete('/:id', allowAdminAndEmployee, customerController.remove);

module.exports = router;

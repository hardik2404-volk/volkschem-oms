// ============================================================================
// VOLKSCHEM OMS — Label Controller
// ============================================================================

const labelService = require('../services/labelService');
const { sendSuccess, sendError, sendValidationError } = require('../utils/response');

async function getLabelStock(req, res, next) {
  try {
    const { customerId, productId, packSize } = req.params;
    const { packType, requiredPcs } = req.query; // get packType from query
    const data = await labelService.checkLabelStock(
      customerId, 
      productId, 
      packSize, 
      parseInt(requiredPcs) || 0
    );
    return sendSuccess(res, data, 'Label stock retrieved.');
  } catch (err) {
    next(err);
  }
}

async function addBatch(req, res, next) {
  try {
    const { customer_id, product_id, pack_size, pack_type, batch_quantity, rate_per_label } = req.body;
    
    // Check if exists
    const stockCheck = await labelService.checkLabelStock(customer_id, product_id, pack_size, 0);
    let data;
    
    if (stockCheck.isFirstOrder) {
      data = await labelService.createLabelInventory(customer_id, product_id, pack_size, pack_type, '-', batch_quantity, rate_per_label, 0);
    } else {
      data = await labelService.addLabelBatch(stockCheck.inventoryId, batch_quantity, rate_per_label, 0);
    }
    
    return sendSuccess(res, data, 'Label batch added.', 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function getCustomerLabelInventory(req, res, next) {
  try {
    const data = await labelService.getLabelInventoryForCustomer(req.params.customerId);
    return sendSuccess(res, data, 'Customer label inventory retrieved.');
  } catch (err) { next(err); }
}

module.exports = {
  getLabelStock,
  addBatch,
  getCustomerLabelInventory
};

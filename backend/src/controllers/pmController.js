// ============================================================================
// VOLKSCHEM OMS — PM Controller
// ============================================================================

const pmService = require('../services/pmService');
const { sendSuccess, sendError, sendValidationError } = require('../utils/response');

async function getPMStock(req, res, next) {
  try {
    const { customerId, productId, packSize } = req.params;
    const { packType, requiredPcs } = req.query; // get packType from query
    const data = await pmService.checkPMStock(
      customerId, 
      productId, 
      packSize, 
      parseInt(requiredPcs) || 0
    );
    return sendSuccess(res, data, 'PM stock retrieved.');
  } catch (err) {
    next(err);
  }
}

async function addBatch(req, res, next) {
  try {
    const { customer_id, product_id, pack_size, pack_type, batch_quantity, rate_per_pm } = req.body;
    
    // Check if exists
    const stockCheck = await pmService.checkPMStock(customer_id, product_id, pack_size, 0);
    let data;
    
    if (stockCheck.isFirstOrder) {
      data = await pmService.createPMInventory(customer_id, product_id, pack_size, pack_type, '-', batch_quantity, rate_per_pm, 0);
    } else {
      data = await pmService.addPMBatch(stockCheck.inventoryId, batch_quantity, rate_per_pm, 0);
    }
    
    return sendSuccess(res, data, 'PM batch added.', 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function getCustomerPMInventory(req, res, next) {
  try {
    const data = await pmService.getPMInventoryForCustomer(req.params.customerId);
    return sendSuccess(res, data, 'Customer pm inventory retrieved.');
  } catch (err) { next(err); }
}

module.exports = {
  getPMStock,
  addBatch,
  getCustomerPMInventory
};

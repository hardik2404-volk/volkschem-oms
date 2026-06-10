const customerService = require('../services/customerService');
const { sendSuccess, sendError } = require('../utils/response');

async function getAll(req, res, next) {
  try {
    const data = await customerService.getAllCustomers(req.query);
    return sendSuccess(res, data, 'Customers retrieved.');
  } catch (err) { next(err); }
}

async function getById(req, res, next) {
  try {
    const data = await customerService.getCustomerById(req.params.id);
    return sendSuccess(res, data, 'Customer retrieved.');
  } catch (err) { next(err); }
}

async function create(req, res, next) {
  try {
    const data = await customerService.createCustomer(req.body, req.user.id);
    return sendSuccess(res, data, 'Customer created.', 201);
  } catch (err) { next(err); }
}

async function update(req, res, next) {
  try {
    const data = await customerService.updateCustomer(req.params.id, req.body);
    return sendSuccess(res, data, 'Customer updated.');
  } catch (err) { next(err); }
}

async function remove(req, res, next) {
  try {
    await customerService.deleteCustomer(req.params.id);
    return sendSuccess(res, null, 'Customer deactivated.');
  } catch (err) { next(err); }
}

async function getHistory(req, res, next) {
  try {
    const data = await customerService.getCustomerHistory(req.params.id);
    return sendSuccess(res, data, 'Customer history retrieved.');
  } catch (err) { next(err); }
}

module.exports = { getAll, getById, create, update, remove, getHistory };

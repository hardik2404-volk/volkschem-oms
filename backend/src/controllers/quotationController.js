// ============================================================================
// VOLKSCHEM OMS — Quotation Controller
// ============================================================================

const quotationService = require('../services/quotationService');
const { sendSuccess, sendError, sendValidationError } = require('../utils/response');

async function getQuotations(req, res, next) {
  try {
    const filters = {
      status: req.query.status,
      order_type: req.query.order_type,
      product_order_type: req.query.product_order_type,
      from_date: req.query.from_date,
      to_date: req.query.to_date,
      customer_name: req.query.customer_name,
    };

    const data = await quotationService.getQuotations(req.user.id, req.user.role, filters);
    return sendSuccess(res, data, 'Quotations retrieved.');
  } catch (err) {
    next(err);
  }
}

async function getQuotation(req, res, next) {
  try {
    const data = await quotationService.getQuotationById(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, data, 'Quotation detail retrieved.');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

const customerService = require('../services/customerService');

async function createQuotation(req, res, next) {
  try {
    const { validateQuotation } = require('../../../quotation-engine/validators/quotationValidator');
    const validation = validateQuotation(req.body);
    if (!validation.isValid) {
      return sendValidationError(res, validation.errors);
    }

    // Auto-save new customer
    if (req.body.customer_name && req.body.customer_name.trim() !== '') {
      try {
        const customerNameStr = req.body.customer_name.trim();
        const customers = await customerService.getAllCustomers(customerNameStr);
        const exists = customers.find(c => c.customer_name.trim().toLowerCase() === customerNameStr.toLowerCase());
        if (!exists) {
          await customerService.createCustomer({
            customer_name: req.body.customer_name,
            gst_pan: req.body.gst_pan,
            billing_address: req.body.billing_address,
            contact_number: req.body.customer_contact,
            transport_name: req.body.transport_name,
            destination: req.body.destination
          });
        }
      } catch (err) {
        console.error('Failed to auto-save customer:', err);
      }
    }

    // PM validation is already handled by frontend and service.

    const data = await quotationService.createQuotation(req.body, req.user.id);
    return sendSuccess(res, data, 'Quotation created.', 201);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function updateQuotation(req, res, next) {
  try {
    const { validateQuotation } = require('../../../quotation-engine/validators/quotationValidator');
    // We only validate if there are rows, because partial updates might not contain full quotation data.
    // However, if the frontend sends the whole object, we should validate it.
    if (req.body.rows) {
      const validation = validateQuotation(req.body);
      if (!validation.isValid) {
        return sendValidationError(res, validation.errors);
      }
    }

    // Auto-save new customer
    if (req.body.customer_name && req.body.customer_name.trim() !== '') {
      try {
        const customerNameStr = req.body.customer_name.trim();
        const customers = await customerService.getAllCustomers(customerNameStr);
        const exists = customers.find(c => c.customer_name.trim().toLowerCase() === customerNameStr.toLowerCase());
        if (!exists) {
          await customerService.createCustomer({
            customer_name: req.body.customer_name,
            gst_pan: req.body.gst_pan,
            billing_address: req.body.billing_address,
            contact_number: req.body.customer_contact,
            transport_name: req.body.transport_name,
            destination: req.body.destination
          });
        }
      } catch (err) {
        console.error('Failed to auto-save customer:', err);
      }
    }

    const data = await quotationService.updateQuotation(
      req.params.id, req.body, req.user.id, req.user.role
    );
    return sendSuccess(res, data, 'Quotation updated.');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function submitQuotation(req, res, next) {
  try {
    const data = await quotationService.submitQuotation(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, data, 'Quotation submitted for approval.');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function approveQuotation(req, res, next) {
  try {
    const data = await quotationService.approveQuotation(
      req.params.id, req.body.admin_note, req.user.id
    );
    return sendSuccess(res, data, 'Quotation approved. Order created.');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function rejectQuotation(req, res, next) {
  try {
    const { rejection_comment } = req.body;
    if (!rejection_comment) {
      return sendValidationError(res, ['Rejection comment is required.']);
    }

    const data = await quotationService.rejectQuotation(req.params.id, rejection_comment, req.user.id);
    return sendSuccess(res, data, 'Quotation rejected.');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function previewQuotation(req, res, next) {
  try {
    const data = await quotationService.getQuotationPreview(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, data, 'Quotation preview retrieved.');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

const pdfService = require('../../../pdf-generator/pdfService');
const excelService = require('../../../excel-generator/excelService');

async function downloadDraftPDF(req, res, next) {
  try {
    const data = await quotationService.getQuotationById(req.params.id, req.user.id, req.user.role);
    const pdfBuffer = await pdfService.generateCustomerPDF(data.id, data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Draft_Quotation_${data.quotation_number}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function downloadCustomerPDF(req, res, next) {
  try {
    const data = await quotationService.getQuotationById(req.params.id, req.user.id, req.user.role);
    const pdfBuffer = await pdfService.generateCustomerPDF(data.id, data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Customer_Quotation_${data.quotation_number}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function downloadSupervisorPDF(req, res, next) {
  try {
    const data = await quotationService.getQuotationById(req.params.id, req.user.id, req.user.role);
    const pdfBuffer = await pdfService.generateSupervisorPDF(data.id, data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Supervisor_Order_${data.quotation_number}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function downloadProductionPDF(req, res, next) {
  try {
    const data = await quotationService.getQuotationById(req.params.id, req.user.id, req.user.role);
    const pdfBuffer = await pdfService.generateProductionPDF(data.id, data);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Production_Order_${data.quotation_number}.pdf`);
    return res.send(pdfBuffer);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function downloadExcel(req, res, next) {
  try {
    const data = await quotationService.getQuotationById(req.params.id, req.user.id, req.user.role);
    const excelBuffer = await excelService.generateExcel(data);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=Internal_Calculation_${data.quotation_number}.xlsx`);
    return res.send(excelBuffer);
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

async function deleteQuotation(req, res, next) {
  try {
    const data = await quotationService.deleteQuotation(req.params.id, req.user.id, req.user.role);
    return sendSuccess(res, data, 'Quotation deleted successfully.');
  } catch (err) {
    if (err.statusCode) return sendError(res, err.message, err.statusCode);
    next(err);
  }
}

module.exports = {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  submitQuotation,
  approveQuotation,
  rejectQuotation,
  previewQuotation,
  downloadDraftPDF,
  downloadCustomerPDF,
  downloadSupervisorPDF,
  downloadProductionPDF,
  downloadExcel,
  deleteQuotation,
};

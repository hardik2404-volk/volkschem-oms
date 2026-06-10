// ============================================================================
// VOLKSCHEM OMS — Quotation Routes
// ============================================================================

const express = require('express');
const { authenticate } = require('../middleware/auth');
const { allowAdmin, allowAdminAndEmployee, allowAll } = require('../middleware/roleGuard');
const quotationController = require('../controllers/quotationController');

const router = express.Router();

// All routes require authentication
router.use(authenticate);

// ── CRUD ────────────────────────────────────────────────────────────────────
// GET    /api/v1/quotations              — admin sees all, employee sees own
router.get('/', allowAdminAndEmployee, quotationController.getQuotations);

// POST   /api/v1/quotations              — admin + employee
router.post('/', allowAdminAndEmployee, quotationController.createQuotation);

// GET    /api/v1/quotations/:id          — admin + employee (own)
router.get('/:id', allowAdminAndEmployee, quotationController.getQuotation);

// PUT    /api/v1/quotations/:id          — admin + employee (own, draft/rejected only)
router.put('/:id', allowAdminAndEmployee, quotationController.updateQuotation);

// DELETE /api/v1/quotations/:id          — admin + employee (own)
router.delete('/:id', allowAdminAndEmployee, quotationController.deleteQuotation);

// ── Status Transitions ──────────────────────────────────────────────────────
// PUT    /api/v1/quotations/:id/submit   — draft → pending
router.put('/:id/submit', allowAdminAndEmployee, quotationController.submitQuotation);

// PUT    /api/v1/quotations/:id/approve  — admin only, pending → approved
router.put('/:id/approve', allowAdmin, quotationController.approveQuotation);

// PUT    /api/v1/quotations/:id/reject   — admin only, pending → rejected
router.put('/:id/reject', allowAdmin, quotationController.rejectQuotation);

// ── Preview & Downloads ─────────────────────────────────────────────────────
// GET    /api/v1/quotations/:id/preview
router.get('/:id/preview', allowAdminAndEmployee, quotationController.previewQuotation);

// GET    /api/v1/quotations/:id/download/draft-pdf
router.get('/:id/download/draft-pdf', allowAdminAndEmployee, quotationController.downloadDraftPDF);

// GET    /api/v1/quotations/:id/download/customer-pdf
router.get('/:id/download/customer-pdf', allowAdminAndEmployee, quotationController.downloadCustomerPDF);

// GET    /api/v1/quotations/:id/download/factory-pdf
router.get('/:id/download/factory-pdf', allowAll, quotationController.downloadSupervisorPDF);

// GET    /api/v1/quotations/:id/download/production-pdf
router.get('/:id/download/production-pdf', allowAll, quotationController.downloadProductionPDF);

// GET    /api/v1/quotations/:id/download/excel
router.get('/:id/download/excel', allowAdminAndEmployee, quotationController.downloadExcel);

module.exports = router;

// ============================================================================
// VOLKSCHEM OMS — PDF Service Orchestrator
// ============================================================================

const { generateCustomerQuotationPDF } = require('./templates/customerQuotationTemplate');
const { generateSupervisorOrderPDF } = require('./templates/supervisorOrderTemplate');
const { generateProductionOrderPDF } = require('./templates/productionOrderTemplate');
const { applyDraftWatermark } = require('./templates/draftWatermarkTemplate');
const PDFDocument = require('pdfkit');
const { generateHeader } = require('./sections/headerSection');
const { generateCustomerSection } = require('./sections/customerSection');
const { generateProductTable } = require('./sections/productTableSection');
const { generateLabelInventorySection } = require('./sections/labelInventorySection');
const { generateTotalsSection } = require('./sections/totalsSection');
const { generateTermsSection } = require('./sections/termsSection');

/**
 * Orchestrator: Generate Customer PDF
 */
async function generateCustomerPDF(quotationId, quotationData) {
  return await generateCustomerQuotationPDF(quotationData);
}

/**
 * Orchestrator: Generate Supervisor PDF
 */
async function generateSupervisorPDF(quotationId, quotationData) {
  return await generateSupervisorOrderPDF(quotationData);
}

/**
 * Orchestrator: Generate Production PDF
 */
async function generateProductionPDF(quotationId, quotationData) {
  return await generateProductionOrderPDF(quotationData);
}

/**
 * Orchestrator: Generate Draft PDF
 * To apply the watermark with PDFKit, we must regenerate the PDF and inject the watermark
 * before doc.end().
 */
async function generateDraftPDF(quotationId, quotationData) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 0,
        bufferPages: true,
      });

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      let currentY = 0;
      currentY = generateHeader(doc, quotationData);
      currentY = generateCustomerSection(doc, quotationData, currentY);
      currentY = generateProductTable(doc, quotationData, currentY, false);
      
      if (quotationData.label_inventory) {
        currentY = generateLabelInventorySection(doc, quotationData.label_inventory, currentY);
      }

      if (currentY > doc.page.height - 150) {
        doc.addPage();
        currentY = 40;
      }

      generateTotalsSection(doc, quotationData, currentY);
      generateTermsSection(doc, currentY);

      // Add Page Numbers
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor('#999999').text(`Page ${i + 1} of ${pages.count}`, 0, doc.page.height - 20, { align: 'center' });
      }

      // APPLY WATERMARK BEFORE ENDING
      applyDraftWatermark(doc);

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  generateCustomerPDF,
  generateSupervisorPDF,
  generateProductionPDF,
  generateDraftPDF,
};

// ============================================================================
// VOLKSCHEM OMS — Customer Quotation Template
// ============================================================================

const PDFDocument = require('pdfkit');
const { generateHeader } = require('../sections/headerSection');
const { generateCustomerSection } = require('../sections/customerSection');
const { generateProductTable } = require('../sections/productTableSection');
const { generateLabelInventorySection } = require('../sections/labelInventorySection');
const { generateTotalsSection } = require('../sections/totalsSection');
const { generateTermsSection } = require('../sections/termsSection');

/**
 * Generate a complete customer-facing Quotation PDF.
 *
 * @param {Object} quotationData - Full populated quotation object
 * @returns {Promise<Buffer>}
 */
function generateCustomerQuotationPDF(quotationData) {
  return new Promise((resolve, reject) => {
    try {
      // Create portrait A4 document
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'portrait',
        margin: 0,
        bufferPages: true,
      });

      const path = require('path');
      doc.registerFont('NotoSans', path.join(__dirname, '../../pdf-generator/fonts/NotoSans-Regular.ttf'));
      doc.registerFont('NotoSans-Bold', path.join(__dirname, '../../pdf-generator/fonts/NotoSans-Bold.ttf'));
      doc.font('NotoSans');

      const buffers = [];
      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => resolve(Buffer.concat(buffers)));

      // Add DRAFT watermark if status is Draft or Pending
      if (quotationData.status === 'Draft' || quotationData.status === 'Pending') {
        doc.on('pageAdded', () => {
          doc.save();
          doc.translate(doc.page.width / 2, doc.page.height / 2);
          doc.rotate(-45);
          doc.font('NotoSans-Bold')
             .fontSize(120)
             .fillColor('#EEEEEE')
             .text('DRAFT', -200, -50, { align: 'center', width: 400 });
          doc.restore();
        });
        
        // Add watermark to the first page (since event only fires on pageAdded)
        doc.save();
        doc.translate(doc.page.width / 2, doc.page.height / 2);
        doc.rotate(-45);
        doc.font('NotoSans-Bold')
           .fontSize(120)
           .fillColor('#EEEEEE')
           .text('DRAFT', -200, -50, { align: 'center', width: 400 });
        doc.restore();
      }

      let currentY = 0;

      // 1. Header
      currentY = generateHeader(doc, quotationData);

      // 2. Customer Details
      currentY = generateCustomerSection(doc, quotationData, currentY);

      // 3. Product Table
      currentY = generateProductTable(doc, quotationData, currentY, false);

      if (quotationData.rows && quotationData.rows.length > 0) {
        const labelDataArray = [];
        quotationData.rows.forEach((snapshotRow) => {
          if (snapshotRow.label_snapshot && !snapshotRow.label_snapshot.withoutLabel && !snapshotRow.label_snapshot.without_label) {
            const snap = snapshotRow.label_snapshot;
            
            // Only show the block if it should be included
            if (!snap.include_in_quotation && !snap.is_new_batch) return;

            const isNewBatch = snap.is_new_batch;
            
            labelDataArray.push({
              product_name: snapshotRow.products?.product_name || '-',
              pack_type: snap.pack_type,
              pack_size: snap.pack_size,
              open_stock: snap.open_stock,
              make: isNewBatch ? snap.make_quantity : 0, 
              total_stock: snap.total_stock, 
              used: snap.used_to_date,
              closing_stock: snap.closing_stock,
              rate: isNewBatch ? snap.rate_per_label : 0,
              amount: isNewBatch ? snap.current_batch_amount : 0,
              gst: isNewBatch ? snap.current_batch_gst : 0,
              total_with_gst: isNewBatch ? snap.current_batch_total : 0,
              is_new_batch: isNewBatch
            });
          }
        });
        
        if (labelDataArray.length > 0) {
          currentY = generateLabelInventorySection(doc, labelDataArray, currentY, false);
        }
      }

      // Check if we need a new page for totals & terms
      if (currentY > doc.page.height - 150) {
        doc.addPage();
        currentY = 40;
      }

      // 5. Totals & Bank Details
      currentY = generateTotalsSection(doc, quotationData, currentY);

      // 6. Terms & Conditions
      currentY = generateTermsSection(doc, currentY);

      // 7. Add Page Numbers
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor('#999999')
          .text(
            `Page ${i + 1} of ${pages.count}`,
            0,
            doc.page.height - 20,
            { align: 'right', width: doc.page.width - 30 }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateCustomerQuotationPDF };

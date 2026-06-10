// ============================================================================
// VOLKSCHEM OMS — Production Order Template
// ============================================================================

const PDFDocument = require('pdfkit');
const { generateHeader } = require('../sections/headerSection');
const { generateCustomerSection } = require('../sections/customerSection');
const { generateProductionTable } = require('../sections/productionTableSection');

/**
 * Generate a Factory Production Order PDF.
 * Uses 3 distinct dynamic table layouts based on the order type and packing size.
 *
 * @param {Object} quotationData
 * @returns {Promise<Buffer>}
 */
function generateProductionOrderPDF(quotationData) {
  return new Promise((resolve, reject) => {
    try {
      // Create landscape A4 document
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
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

      let currentY = 0;

      // 1. Header
      currentY = generateHeader(doc, quotationData);

      // 2. Customer Section (Title 'PRODUCTION ORDER')
      currentY = generateCustomerSection(doc, quotationData, currentY, 'PRODUCTION ORDER');

      // 3. Dynamic Production Table
      currentY = generateProductionTable(doc, quotationData, currentY);

      // 4. Operator Sign-offs
      if (currentY > doc.page.height - 120) {
        doc.addPage();
        currentY = 40;
      }
      
      currentY += 30;
      const margin = 30;
      doc.rect(margin, currentY, (doc.page.width - margin * 2), 60).strokeColor('#E0E0E0').lineWidth(1).stroke();
      
      const boxWidth = (doc.page.width - margin * 2) / 4;
      doc.fillColor('#000').font('NotoSans-Bold').fontSize(9);
      
      // Draw vertical separators and text
      ['PREPARED BY (STORE)', 'CHECKED BY (SUPERVISOR)', 'PACKED BY (OPERATOR)', 'DISPATCHED BY'].forEach((label, i) => {
        const x = margin + (boxWidth * i);
        if (i > 0) {
          doc.moveTo(x, currentY).lineTo(x, currentY + 60).strokeColor('#E0E0E0').lineWidth(1).stroke();
        }
        doc.text(label, x + 10, currentY + 10, { width: boxWidth - 20, align: 'center' });
        doc.font('NotoSans').fontSize(8).fillColor('#666').text('Sign & Date:', x + 10, currentY + 45);
        doc.font('NotoSans-Bold').fontSize(9).fillColor('#000');
      });

      // Add Page Numbers and Custom Footer
      const { formatIndianDate } = require('../utils/dateFormatter');
      const pages = doc.bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .font('NotoSans')
          .fillColor('#999999')
          .text(
            `Volkschem Crop Science Pvt. Ltd. | Production Order | Page ${i + 1} of ${pages.count} | Generated: ${formatIndianDate(new Date())}`,
            0,
            doc.page.height - 20,
            { align: 'center' }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateProductionOrderPDF };

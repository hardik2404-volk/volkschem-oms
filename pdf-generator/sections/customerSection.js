// ============================================================================
// VOLKSCHEM OMS — PDF Customer Details Section
// ============================================================================

const { formatIndianDate } = require('../utils/dateFormatter');

/**
 * Generate the customer details block with a bordered box.
 *
 * @param {PDFDocument} doc
 * @param {Object} data
 * @param {number} startY
 * @param {string} title - Optional title (e.g. 'PRODUCTION ORDER')
 */
function generateCustomerSection(doc, data, startY, title = null) {
  const margin = 30;
  let currentY = startY;

  // Optional Title (used for Factory Order)
  if (title) {
    doc
      .font('NotoSans-Bold')
      .fontSize(14)
      .fillColor('#1B5E20')
      .text(title, margin, currentY, { align: 'center', width: doc.page.width - (margin * 2) });
    currentY += 25;
  }

  const startCustomerY = currentY;

  // ── Left Side: Bill To ──────────────────────────────────────────────────
  doc.font('NotoSans-Bold').fontSize(10).fillColor('#1B5E20');
  doc.text('Bill To', margin, currentY);
  currentY += 15;

  doc.font('NotoSans-Bold').fontSize(10).fillColor('#333333');
  doc.text(data.billing_name || data.customer_name || 'N/A', margin, currentY);
  currentY += 15;

  doc.font('NotoSans').fontSize(9).fillColor('#333333');

  if (data.billing_address) {
    doc.text(data.billing_address, margin, currentY, { width: 300 });
    const lines = Math.ceil(data.billing_address.length / 50);
    currentY += 12 * lines;
  }

  currentY += 5;
  doc.text(`GSTIN: ${data.gst_pan || 'N/A'}`, margin, currentY);
  
  const endCustomerY = currentY + 12;

  // ── Right Side: Quote Details Box ───────────────────────────────────────
  currentY = startCustomerY + 15; // Align roughly with Bill To name
  const boxWidth = 160;
  const boxHeight = 40;
  const rightMargin = doc.page.width - margin;
  const boxX = rightMargin - boxWidth;

  // Draw light gray box with border
  doc.rect(boxX, currentY, boxWidth, boxHeight).fillAndStroke('#EAEAEA', '#CCCCCC');

  doc.fillColor('#333333');
  
  // Quote No
  doc.font('NotoSans-Bold').fontSize(9);
  doc.text('Quote No:', boxX + 10, currentY + 8);
  doc.font('NotoSans').fontSize(9);
  doc.text(data.quotation_number || 'N/A', boxX + 70, currentY + 8);

  // Date
  doc.font('NotoSans-Bold').fontSize(9);
  doc.text('Date:', boxX + 10, currentY + 22);
  doc.font('NotoSans').fontSize(9);
  doc.text(formatIndianDate(data.quotation_date), boxX + 70, currentY + 22);

  // Return the maximum Y reached by either left or right blocks
  return Math.max(endCustomerY, currentY + boxHeight) + 20;
}

module.exports = { generateCustomerSection };

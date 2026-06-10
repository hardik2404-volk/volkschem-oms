const path = require('path');

function generateTermsSection(doc, startY) {
  const margin = 30;
  let currentY = startY + 40;

  // ── Left Side: Terms & Conditions ───────────────────────────────────────
  doc
    .font('NotoSans-Bold')
    .fontSize(10)
    .fillColor('#333333')
    .text('Terms & Conditions:', margin, currentY);

  const terms = [
    '1. Prices are inclusive of packing material.',
    '2. GST will be charged as applicable.',
    '3. Payment Terms: 100% advance with order.',
    '4. Freight: Included up to destination.',
    '5. Quotation valid till the date mentioned above.',
    '6. Subject to local jurisdiction only.',
    '7. Company reserves the right to change the prices without prior notice.'
  ];

  doc.font('NotoSans').fontSize(8).fillColor('#333333');
  terms.forEach((term, idx) => {
    doc.text(term, margin, currentY + 20 + (idx * 12));
  });

  // ── Right Side: Signature Block ─────────────────────────────────────────
  const rightX = doc.page.width - 250;
  const sigY = currentY;

  // Empty space for signature
  doc.moveTo(rightX + 20, sigY + 50).lineTo(rightX + 180, sigY + 50).lineWidth(0.5).strokeColor('#333333').stroke();

  doc.font('NotoSans-Bold').fontSize(9).fillColor('#333333');
  doc.text('Authorized Signatory', rightX, sigY + 60, { width: 200, align: 'center' });

  return sigY + 90;
}

module.exports = { generateTermsSection };

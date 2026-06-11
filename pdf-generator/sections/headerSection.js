// ============================================================================
// VOLKSCHEM OMS — PDF Header Section
// ============================================================================

const path = require('path');

/**
 * Generate the top header section of the PDF.
 *
 * @param {PDFDocument} doc
 * @param {Object} quotationData
 */
function generateHeader(doc, quotationData, titleText = 'QUOTATION') {
  const pageWidth = doc.page.width;
  const margin = 30;
  let currentY = 0; // Start right at the top

  // ── Top Header Bar ──────────────────────────────────────────────────────
  const headerHeight = 100;

  // Background Dark Green Bar removed as requested

  // Left side: Logo Box
  // Draw a white box for the logo to sit inside
  const logoBoxWidth = 255;
  const logoBoxHeight = 65;
  doc.rect(margin, currentY + 10, logoBoxWidth, logoBoxHeight).fill('#FFFFFF');

  const logoPath = path.resolve(__dirname, '../../assets/logo/fix-site-logo.png');
  try {
    // Fit logo perfectly in the white box
    doc.image(logoPath, margin, currentY + 10, { width: logoBoxWidth, height: logoBoxHeight });
  } catch (err) {
    doc.font('NotoSans-Bold').fontSize(12).fillColor('#204938').text('LOGO', margin + 10, currentY + 25);
  }

  // Right side: Address
  doc.font('NotoSans').fontSize(8).fillColor('#000000');
  const rightMargin = pageWidth - margin;

  // Custom alignment for address text within the dark bar
  const addressText = "Phone: +91 9574009098   |   Email: info@volkschem.com\nCORPORATE OFFICE:\nC/806-807-808, SIGNATURE 2, BUSINESS PARK,\nSANAND CROSS ROAD, OPP. HOTEL SABRA CROSSWAY,\nAHMEDABAD - 382210, GUJARAT (INDIA)\nGST NO: 24AAFCV2675N1ZU   |   CIN NO: U24100GJ2015PTC084879";

  doc.text(addressText, rightMargin - 300, currentY + 12, { width: 300, align: 'right', lineGap: 2 });

  currentY += headerHeight;

  // ── QUOTATION Title Bar ─────────────────────────────────────────────────
  const titleBarHeight = 30;
  doc.rect(0, currentY, pageWidth, titleBarHeight).fill('#EAEAEA');

  doc.font('NotoSans-Bold').fontSize(16).fillColor('#333333');
  // Center text perfectly in the gray bar
  doc.text(titleText.toUpperCase(), 0, currentY + 7, { align: 'center', width: pageWidth });

  currentY += titleBarHeight;

  // Add spacing before the next section
  return currentY + 20;
}

module.exports = { generateHeader };

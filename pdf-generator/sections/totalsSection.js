function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

function generateTotalsSection(doc, quotationData, startY) {
  const margin = 30;
  const pageWidth = doc.page.width - (margin * 2);
  let currentY = startY;

  // ── Totals Box (Right Aligned) ───────────────────────────────────
  // We want to align this roughly with the end of the table
  const boxWidth = 240;
  const boxX = margin + pageWidth - boxWidth;
  const rowHeight = 25;

  // Function to draw a row
  const drawRow = (label, value, isGrandTotal = false, isCurrency = true) => {
    // Background and border
    if (isGrandTotal) {
      doc.rect(boxX, currentY, boxWidth, rowHeight).fillAndStroke('#1B5E20', '#1B5E20');
      doc.fillColor('#FFFFFF');
    } else {
      doc.rect(boxX, currentY, boxWidth, rowHeight).fillAndStroke('#EAEAEA', '#CCCCCC');
      doc.fillColor('#333333');
    }

    doc.font(isGrandTotal ? 'NotoSans-Bold' : 'NotoSans').fontSize(10);
    
    // Label on left
    doc.text(label, boxX + 10, currentY + 7);
    
    // Value on right
    const displayValue = isCurrency ? formatCurrency(value) : new Intl.NumberFormat('en-IN').format(value);
    doc.text(displayValue, boxX + 10, currentY + 7, { width: boxWidth - 20, align: 'right' });
    
    currentY += rowHeight;
  };

  let totalQty = 0;
  let qtyLabel = 'Total Qty';
  if (quotationData.order_type === 'bulk') {
    totalQty = quotationData.rows?.reduce((sum, r) => sum + (r.total_quantity_ltr_kg || 0), 0) || quotationData.quantity || 0;
    qtyLabel = `Total Qty (Ltr/Kg)`;
  } else {
    totalQty = quotationData.rows?.reduce((sum, r) => sum + (r.total_pcs || 0), 0) || 0;
    qtyLabel = 'Total Qty (Pcs)';
  }

  // Calculate PM Total
  let pmTotal = 0;
  if (quotationData.rows) {
    quotationData.rows.forEach(r => {
      if (r.pm_snapshot && !r.pm_snapshot.withoutPM && !r.pm_snapshot.without_pm) {
        const snap = r.pm_snapshot;
        if (snap.is_new_batch) {
          pmTotal += (snap.current_batch_total || snap.total_amount || 0);
        }
      }
    });
  }

  // Calculate Product Total (Subtotal + GST)
  const productTotal = (quotationData.subtotal || 0) + (quotationData.total_gst || 0);

  // Draw Totals Rows
  const startTotalsY = currentY;
  drawRow(qtyLabel, totalQty, false, false);
  drawRow('Product Total', productTotal);
  
  if (pmTotal > 0) {
    drawRow('PM Total', pmTotal);
  }
  
  drawRow('Grand Total (Including GST)', quotationData.grand_total, true);

  const endTotalsY = currentY;

  // ── Payment Details Box (Left Aligned) ──────────────────────────────────
  const path = require('path');
  const paymentBoxWidth = 250;
  const paymentBoxHeight = 85;
  const paymentBoxX = margin;
  const paymentY = startTotalsY; // Align with the top of the Totals Box

  // Header for Payment Details
  const paymentHeaderHeight = 20;
  doc.rect(paymentBoxX, paymentY, paymentBoxWidth, paymentHeaderHeight).fillAndStroke('#1B5E20', '#1B5E20');
  doc.font('NotoSans-Bold').fontSize(9).fillColor('#FFFFFF');
  doc.text('PAYMENT DETAILS', paymentBoxX, paymentY + 5, { width: paymentBoxWidth, align: 'center' });

  // Body of Payment Details
  doc.rect(paymentBoxX, paymentY + paymentHeaderHeight, paymentBoxWidth, paymentBoxHeight - paymentHeaderHeight).stroke('#1B5E20');
  
  doc.font('NotoSans-Bold').fontSize(7).fillColor('#333333');
  const detailsY = paymentY + 25;
  doc.text('Beneficiary Name: ', paymentBoxX + 5, detailsY, { continued: true }).font('NotoSans').text('Volkschem Crop Science Pvt.Ltd.');
  doc.font('NotoSans-Bold').text('Bank Name: ', paymentBoxX + 5, detailsY + 12, { continued: true }).font('NotoSans').text('Canara bank');
  doc.font('NotoSans-Bold').text('Account Number: ', paymentBoxX + 5, detailsY + 24, { continued: true }).font('NotoSans').text('3190261000035');
  doc.font('NotoSans-Bold').text('IFSC Code: ', paymentBoxX + 5, detailsY + 36, { continued: true }).font('NotoSans').text('CNRB0003190');
  doc.font('NotoSans-Bold').text('Branch: ', paymentBoxX + 5, detailsY + 48, { continued: true }).font('NotoSans').text('Rakanpur - 382721');

  // QR Code
  try {
    const qrPath = path.resolve(__dirname, '../../assets/logo/pay-qr.jpeg');
    const qrSize = 40;
    doc.image(qrPath, paymentBoxX + paymentBoxWidth - qrSize - 10, detailsY + 5, { width: qrSize, height: qrSize });
    doc.font('NotoSans').fontSize(6).text('Scan to Pay', paymentBoxX + paymentBoxWidth - qrSize - 10, detailsY + qrSize + 8, { width: qrSize, align: 'center' });
  } catch (err) {}

  return Math.max(endTotalsY, paymentY + paymentBoxHeight) + 20;
}

module.exports = { generateTotalsSection };

// ============================================================================
// VOLKSCHEM OMS — PDF PM Inventory Section
// ============================================================================

const { formatCurrency } = require('./productTableSection'); // Reusing currency formatter if exported.
// Let's implement local formatCurrency to be safe
function formatLocalCurrency(amount) {
  if (amount == null || isNaN(amount)) return '-';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(amount);
}

/**
 * Generate the PM Inventory Details block.
 * Rendered only when a label component is checked.
 *
 * @param {PDFDocument} doc
 * @param {Array|Object} labelDataInput - Aggregated label section info (array or single object)
 * @param {number} startY
 */
function generatePMInventorySection(doc, labelDataInput, startY, isFactoryView = false) {
  if (!labelDataInput) return startY; // skip if no data
  
  // Normalize to array
  const pmDataArray = Array.isArray(labelDataInput) ? labelDataInput : [labelDataInput];
  if (pmDataArray.length === 0) return startY;

  const margin = 20;
  const pageWidth = doc.page.width - (margin * 2);
  let currentY = startY + 40; // Increased spacing

  // Section Title
  doc
    .font('NotoSans-Bold')
    .fontSize(10)
    .fillColor('#333333')
    .text('Packing Materials Stock Inventory', margin, currentY);

  currentY += 15;

  const columns = [
    { label: 'PRODUCT', key: 'product_name', width: 70 },
    { label: 'PACK TYPE', key: 'pack_type', width: 60 },
    { label: 'PACK SIZE', key: 'pack_size', width: 60 },
    { label: 'Available Stock', key: 'open_stock', width: 60 },
    { label: 'LABEL MADE', key: 'make', width: 55 },
    { label: 'TOTAL STOCK', key: 'total_stock', width: 60 },
    { label: 'LABEL USED', key: 'used', width: 55 },
    { label: 'CLO. STOCK', key: 'closing_stock', width: 60 },
  ];

  if (!isFactoryView) {
    columns.push(
      { label: 'RATE', key: 'rate', width: 40 },
      { label: 'AMOUNT', key: 'amount', width: 50 },
      { label: 'GST', key: 'gst', width: 50 }
    );
  }

  // Adjust widths proportionally
  const totalDesiredWidth = columns.reduce((sum, col) => sum + col.width, 0);
  if (totalDesiredWidth !== pageWidth) {
    const scale = pageWidth / totalDesiredWidth;
    columns.forEach(col => col.width = col.width * scale);
  }

  // Header Background (Dark Green)
  const headerHeight = 25;
  doc.rect(margin, currentY, pageWidth, headerHeight).fillAndStroke('#1B5E20', '#1B5E20');
  
  // Header Text
  doc.fillColor('#FFFFFF').font('NotoSans-Bold').fontSize(7);
  let currentX = margin;
  columns.forEach(col => {
    doc.text(col.label, currentX + 2, currentY + 7, {
      width: col.width - 4,
      align: 'center',
    });
    currentX += col.width;
  });

  currentY += headerHeight;
  const tableStartY = currentY;

  // Draw Data Rows
  const rowHeight = 20;
  
  let totalPayableAmount = 0;
  let hasNewBatch = false;

  pmDataArray.forEach((labelData, i) => {
    // Add page if needed
    if (currentY > doc.page.height - 100) {
       // Optional: close grid and draw new page, but assuming it fits for now.
    }

    doc.rect(margin, currentY, pageWidth, rowHeight).stroke('#CCCCCC'); // Bordered row
    doc.font('NotoSans').fontSize(7).fillColor('#333333');
    currentX = margin;

    columns.forEach(col => {
      let value = labelData[col.key] != null ? labelData[col.key] : '-';
      
      // Formatting financials
      if (['rate', 'amount', 'gst', 'total_with_gst'].includes(col.key)) {
        value = formatLocalCurrency(labelData[col.key]);
      }

      doc.text(value.toString(), currentX + 2, currentY + 6, {
        width: col.width - 4,
        align: 'center',
      });
      currentX += col.width;
    });
    
    if (labelData.is_new_batch) {
      hasNewBatch = true;
      totalPayableAmount += parseFloat(labelData.total_with_gst) || 0;
    }

    currentY += rowHeight;
  });

  // Draw Vertical Grid lines
  let lineX = margin;
  columns.forEach(col => {
    doc.moveTo(lineX, tableStartY - headerHeight).lineTo(lineX, currentY).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
    lineX += col.width;
  });
  doc.moveTo(lineX, tableStartY - headerHeight).lineTo(lineX, currentY).strokeColor('#CCCCCC').lineWidth(0.5).stroke();
  // Bottom border of the last row is already drawn by rect, but just in case:
  doc.moveTo(margin, currentY).lineTo(margin + pageWidth, currentY).strokeColor('#CCCCCC').lineWidth(0.5).stroke();


  // "TOTAL PAYABLE AMOUNT Rs." row (only if new batch)
  if (!isFactoryView && hasNewBatch) {
    const totalRowHeight = 15;
    doc.rect(margin, currentY, pageWidth, totalRowHeight).fill('#FFF9C4');
    
    // The total amount column starts after the text. The text "TOTAL PAYABLE AMOUNT Rs." aligns right in the space before the GST column.
    doc.fillColor('#333333').font('NotoSans-Bold').fontSize(7);
    doc.text('TOTAL PAYABLE AMOUNT Rs.', margin, currentY + 4, {
      width: pageWidth - columns[columns.length - 1].width - 10,
      align: 'right'
    });
    
    doc.text(formatLocalCurrency(totalPayableAmount), margin + pageWidth - columns[columns.length - 1].width, currentY + 4, {
      width: columns[columns.length - 1].width - 4,
      align: 'right' 
    });

    doc.rect(margin, currentY, pageWidth, totalRowHeight).stroke('#CCCCCC');
    currentY += totalRowHeight;
  }

  return currentY + 10;
}

module.exports = { generatePMInventorySection };

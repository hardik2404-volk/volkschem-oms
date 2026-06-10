const { AMPOULE_PACKAGING } = require('../constants');

function generateAmpouleStructureSection(doc, quotationData, startY) {
  // Check if any row uses Ampoule
  const hasAmpoule = quotationData.rows.some(r => r.packing_type === 'Ampoule');
  if (!hasAmpoule) return startY;
  // Only show if there's an ampoule row
  const ampouleRows = quotationData.rows.filter(r => r.packing_type && r.packing_type.toLowerCase().includes('ampoule'));
  if (ampouleRows.length === 0) return startY;

  const margin = 30; // Aligned with product table
  let currentY = startY;

  if (currentY > doc.page.height - 120) {
    doc.addPage();
    currentY = margin;
  }

  const pageWidth = doc.page.width - (margin * 2);

  doc.rect(margin, currentY, pageWidth, 15).fill('#1B5E20');
  doc.fillColor('#FFFFFF').font('NotoSans-Bold').fontSize(8);
  
  const colWidth = pageWidth / 4;
  const cols = [
    { label: 'INNER BOX FOR AMPOULES', x: margin, w: colWidth },
    { label: 'OUTER BOX', x: margin + colWidth, w: colWidth },
    { label: 'FBB BOX', x: margin + (colWidth * 2), w: colWidth },
    { label: 'TRAY', x: margin + (colWidth * 3), w: colWidth }
  ];

  cols.forEach(c => doc.text(c.label, c.x + 2, currentY + 4, { width: c.w - 4, align: 'center' }));
  currentY += 15;

  doc.font('NotoSans-Bold').fontSize(7);

  // Group by unique pack sizes
  const sizes = [...new Set(ampouleRows.map(r => `${r.pack_size_value}${r.pack_size_unit.toLowerCase()}`))];

  sizes.forEach((size, i) => {
    const isEven = i % 2 === 0;
    doc.rect(margin, currentY, pageWidth, 15).fill(isEven ? '#F9F9F9' : '#FFFFFF');
    doc.fillColor('#333333');

    const spec = AMPOULE_PACKAGING[size];
    if (spec) {
      const pSize = size.toUpperCase();
      const innersInOuter = spec.outerBoxPcs / spec.innerBoxPcs;
      const innerText = `${pSize} x ${spec.innerBoxPcs} NOS= 1 INNER x ${innersInOuter} INNER=1 BOX`;
      const outerText = `${spec.outerBoxPcs} NOS`;
      const fbbText = `${pSize} x ${spec.fbbBoxPcs} NOS`;
      const trayText = `${pSize} x ${spec.trayPcs} NOS`;

      doc.text(innerText, cols[0].x + 2, currentY + 4, { width: cols[0].w - 4, align: 'center' });
      doc.text(outerText, cols[1].x + 2, currentY + 4, { width: cols[1].w - 4, align: 'center' });
      doc.text(fbbText,   cols[2].x + 2, currentY + 4, { width: cols[2].w - 4, align: 'center' });
      doc.text(trayText,  cols[3].x + 2, currentY + 4, { width: cols[3].w - 4, align: 'center' });
    }

    currentY += 15;
  });

  return currentY + 10;
}

module.exports = { generateAmpouleStructureSection };

const fs = require('fs');

const parseUnitFunc = `
function parseUnitMultiplier(unit) {
  if (!unit) return 1;
  const u = unit.toLowerCase().trim();
  if (u === 'ml' || u === 'gm') return 0.001;
  if (u === 'ltr' || u === 'kg') return 1;
  return 1;
}
`;

// Fix Excel Template
let excelCode = fs.readFileSync('d:/volkschem-oms/excel-generator/templates/internalQuotationTemplate.js', 'utf8');
if (!excelCode.includes('function parseUnitMultiplier')) {
  excelCode = excelCode.replace('function generateInternalExcel', parseUnitFunc + '\nasync function generateInternalExcel');
}

excelCode = excelCode.replace(
  "const packWise = parseFloat(row.total_quantity_ltr_kg) || 0;\n    overallTotalLtrKg += packWise;\n    rData['pack_wise'] = packWise;\n    rData['total_ltr'] = overallTotalLtrKg;",
  "const packWise = (row.pack_size_value * parseUnitMultiplier(row.pack_size_unit)) || 0;\n    const rowTotalLtr = packWise * (row.total_pcs || 0);\n    overallTotalLtrKg += rowTotalLtr;\n    rData['pack_wise'] = packWise;\n    rData['total_ltr'] = overallTotalLtrKg;"
);
fs.writeFileSync('d:/volkschem-oms/excel-generator/templates/internalQuotationTemplate.js', excelCode);

// Fix Customer PDF Table
let pdfCode = fs.readFileSync('d:/volkschem-oms/pdf-generator/sections/productTableSection.js', 'utf8');
if (!pdfCode.includes('function parseUnitMultiplier')) {
  pdfCode = pdfCode.replace('function generateSupervisorTable', parseUnitFunc + '\nfunction generateSupervisorTable');
}

pdfCode = pdfCode.replace(
  "rowData['total_amount'] = row.row_total_with_gst ? row.row_total_with_gst.toFixed(2) : '-';",
  "rowData['total_amount'] = row.row_total_with_gst ? row.row_total_with_gst.toFixed(2) : '-';\n\n    const packWise = (row.pack_size_value * parseUnitMultiplier(row.pack_size_unit)) || 0;\n    const rowTotalLtr = packWise * (row.total_pcs || 0);\n    rowData['pack_wise'] = packWise ? Number(packWise.toFixed(4)) : '-';\n    rowData['total_ltr'] = rowTotalLtr ? Number(rowTotalLtr.toFixed(4)) : '-';\n    rowData['total_cases'] = row.total_cases || '-';"
);
fs.writeFileSync('d:/volkschem-oms/pdf-generator/sections/productTableSection.js', pdfCode);

console.log('Done');

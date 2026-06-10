const reportService = require('../services/reportService');
const { sendError } = require('../utils/response');

async function downloadOrdersExcel(req, res, next) {
  try {
    const { range } = req.query; // 'today' or 'monthly'
    if (!['today', 'monthly'].includes(range)) {
      return sendError(res, 'Invalid range parameter. Use "today" or "monthly".', 400);
    }

    const { workbook, filename } = await reportService.generateOrdersExcel(range);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error generating Excel report:', err);
    return sendError(res, 'Failed to generate Excel report.', 500);
  }
}

module.exports = {
  downloadOrdersExcel,
};

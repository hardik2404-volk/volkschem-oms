import api from './api';

export const authService = {
  login: (username, password) => api.post('/auth/login', { username, password }),
  getMe: () => api.get('/auth/me'),
};

export const adminService = {
  getDashboard: () => api.get('/admin/dashboard'),
  getStaff: (params) => api.get('/admin/staff', { params }),
  createStaff: (data) => api.post('/admin/staff', data),
  updateStaff: (id, data) => api.put(`/admin/staff/${id}`, data),
  resetPassword: (id, data) => api.put(`/admin/staff/${id}/reset-password`, data),   // PUT not POST
  toggleStatus: (id) => api.put(`/admin/staff/${id}/toggle-status`),                  // PUT not PATCH
  deleteStaff: (id) => api.delete(`/admin/staff/${id}`),
  getLoginLogs: (params) => api.get('/admin/logs', { params }),                        // /logs not /login-logs
  clearLoginLogs: () => api.delete('/admin/logs'),
  getAllOrders: (params) => api.get('/admin/orders', { params }),
};

export const productService = {
  getAll: (params) => api.get('/products', { params }),
  getById: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
};

export const costSheetService = {
  getAll: (params) => api.get('/cost-sheet', { params }),
  getByCategory: (category) => api.get('/cost-sheet', { params: { category } }),
  getRatesByCategory: (category) => api.get(`/cost-sheet/category/${category}`),
  update: (id, data) => api.put(`/cost-sheet/${id}`, data),
  create: (data) => api.post('/cost-sheet', data),
  delete: (id) => api.delete(`/cost-sheet/${id}`),
};

export const quotationService = {
  getAll: (params) => api.get('/quotations', { params }),
  getById: (id) => api.get(`/quotations/${id}`),
  create: (data) => api.post('/quotations', data),
  update: (id, data) => api.put(`/quotations/${id}`, data),
  submit: (id) => api.put(`/quotations/${id}/submit`),                                 // PUT not POST
  approve: (id, data) => api.put(`/quotations/${id}/approve`, data),                   // PUT not POST
  reject: (id, data) => api.put(`/quotations/${id}/reject`, data),                     // PUT not POST
  downloadPDF: (id, type) => api.get(`/quotations/${id}/download/${type}-pdf`, { responseType: 'blob' }),
  downloadExcel: (id) => api.get(`/quotations/${id}/download/excel`, { responseType: 'blob' }),
  delete: (id) => api.delete(`/quotations/${id}`),
};

export const orderService = {
  getAll: (params) => api.get('/orders', { params: { ...params, _t: Date.now() } }),
  getById: (id) => api.get(`/orders/${id}`),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),                   // PUT not PATCH
  updateNote: (id, note) => api.put(`/orders/${id}/note`, { note }),
  getProgress: (id) => api.get(`/orders/${id}/progress`),
  uploadLR: (id, formData) => api.post(`/orders/${id}/lr`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  deleteLR: (id) => api.delete(`/orders/${id}/lr`),
  delete: (id) => api.delete(`/orders/${id}`),
};

export const labelService = {
  getByProduct: (productId) => api.get(`/labels/${productId}`),
  checkAvailability: (items) => api.post('/labels/check', { items }),
  addBatch: (data) => api.post('/labels/batch', data),
};

export const bulkPriceService = {
  getAll: (params) => api.get('/bulk-prices', { params }),
  create: (data) => api.post('/bulk-prices', data),
  update: (id, data) => api.put(`/bulk-prices/${id}`, data),
  remove: (id) => api.delete(`/bulk-prices/${id}`),
};

export const reportService = {
  downloadOrdersExcel: (range) => api.get('/reports/orders-excel', { params: { range }, responseType: 'blob' }),
};

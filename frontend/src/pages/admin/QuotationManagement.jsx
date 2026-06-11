import React, { useState, useEffect } from 'react';
import { quotationService } from '../../services/dataService';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import { format } from 'date-fns';
import { Eye, CheckCircle, XCircle, Edit, Download, FileText, FileSpreadsheet, Trash2, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

function formatINR(amount) {
  if (amount == null) return '-';
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(amount);
}

export default function QuotationManagement() {
  const [quotations, setQuotations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedQuotation, setSelectedQuotation] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [rejectComment, setRejectComment] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Edit Modal State
  const [editOpen, setEditOpen] = useState(false);
  const [editForm, setEditForm] = useState({ customer_name: '', destination: '', transport_name: '', grand_total: 0 });

  const handleRepeatOrder = () => {
    if (selectedQuotation.order_type === 'product') {
      window.location.href = `/admin/create-quotation?repeatId=${selectedQuotation.id}`;
    } else {
      window.location.href = `/admin/create-bulk?repeatId=${selectedQuotation.id}`;
    }
  };

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [orderTypeFilter, setOrderTypeFilter] = useState('');

  const fetchQuotations = () => {
    setLoading(true);
    const params = {};
    if (statusFilter) params.status = statusFilter;
    if (orderTypeFilter) params.order_type = orderTypeFilter;
    quotationService.getAll(params)
      .then(({ data }) => setQuotations(data.data || []))
      .catch(() => setQuotations([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchQuotations(); }, [statusFilter, orderTypeFilter]);

  const openDetail = async (row) => {
    try {
      const { data } = await quotationService.getById(row.id);
      setSelectedQuotation(data.data);
      setDetailOpen(true);
    } catch {
      toast.error('Failed to load quotation details.');
    }
  };

  const handleApprove = async () => {
    setActionLoading(true);
    try {
      await quotationService.approve(selectedQuotation.id, { admin_note: adminNote });
      toast.success('Quotation approved successfully!');
      setApproveOpen(false);
      setDetailOpen(false);
      setAdminNote('');
      fetchQuotations();
    } catch { /* Error handled by interceptor */ }
    finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!rejectComment.trim()) {
      toast.error('Rejection comment is required.');
      return;
    }
    setActionLoading(true);
    try {
      await quotationService.reject(selectedQuotation.id, { rejection_comment: rejectComment });
      toast.success('Quotation rejected.');
      setRejectOpen(false);
      setDetailOpen(false);
      setRejectComment('');
      fetchQuotations();
    } catch { /* Error handled by interceptor */ }
    finally { setActionLoading(false); }
  };

  const openEditModal = () => {
    setEditForm({
      customer_name: selectedQuotation?.customer_name || '',
      destination: selectedQuotation?.destination || '',
      transport_name: selectedQuotation?.transport_name || '',
      grand_total: selectedQuotation?.grand_total || 0,
    });
    setEditOpen(true);
  };

  const handleEditSubmit = async () => {
    setActionLoading(true);
    try {
      await quotationService.update(selectedQuotation.id, editForm);
      toast.success('Quotation updated successfully!');
      setEditOpen(false);
      setDetailOpen(false);
      fetchQuotations();
    } catch { /* Error handled by interceptor */ }
    finally { setActionLoading(false); }
  };

  const handleDownload = async (type) => {
    try {
      const { data } = await quotationService.downloadPDF(selectedQuotation.id, type);
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedQuotation.quotation_number}_${type}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Download failed.');
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (window.confirm('Are you sure you want to completely delete this quotation? This cannot be undone.')) {
      try {
        await quotationService.delete(id);
        toast.success('Quotation deleted successfully.');
        fetchQuotations();
      } catch {
        toast.error('Failed to delete quotation.');
      }
    }
  };

  const columns = [
    { key: 'quotation_number', header: 'Quote ID', accessor: 'quotation_number' },
    { key: 'product', header: 'Product', render: (r) => {
      if (!r.quotation_rows || r.quotation_rows.length === 0) return '-';
      return (
        <div className="flex flex-col gap-0.5">
          {r.quotation_rows.map((row, idx) => {
            const prodName = row.products?.product_name || row.packing_type || 'N/A';
            const prodCode = row.products?.product_code ? ` (${row.products.product_code})` : '';
            return <span key={idx} className="whitespace-nowrap" title={`${prodName}${prodCode}`}>{prodName}{prodCode}</span>;
          })}
        </div>
      );
    } },
    { key: 'customer_name', header: 'Customer', accessor: 'customer_name' },
    { key: 'employee_name', header: 'Salesman', accessor: 'employee_name' },
    { key: 'order_type', header: 'Type', render: (row) => <Badge status={row.order_type} /> },
    { key: 'grand_total', header: 'Amount', render: (row) => <span className="font-medium">{formatINR(row.grand_total)}</span> },
    { key: 'status', header: 'Status', render: (row) => <Badge status={row.status} /> },
    { key: 'quotation_date', header: 'Date', render: (row) => row.quotation_date ? format(new Date(row.quotation_date), 'dd MMM yyyy') : '-' },
    { key: 'actions', header: 'Actions', sortable: false, render: (row) => (
      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" icon={Eye} onClick={(e) => { e.stopPropagation(); openDetail(row); }}>View</Button>
        <button 
          onClick={(e) => handleDelete(e, row.id)}
          className="text-error/80 hover:text-error hover:bg-error/10 p-1.5 rounded transition-colors ml-1"
          title="Delete Quotation"
        >
          <Trash2 size={16} />
        </button>
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Quotations</h1>
          <p className="text-sm text-text-secondary mt-0.5">Manage and approve quotations</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => window.location.href='/admin/create-quotation'}>Create Product Quote</Button>
          <Button variant="secondary" onClick={() => window.location.href='/admin/create-bulk'}>Create Bulk Quote</Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-lighter/40">
          <option value="">All Statuses</option>
          <option value="draft">Draft</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
        <select value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-lighter/40">
          <option value="">All Types</option>
          <option value="product">Product</option>
          <option value="bulk">Bulk</option>
        </select>
      </div>

      <Table columns={columns} data={quotations} loading={loading} onRowClick={openDetail} searchPlaceholder="Search quotations..." />

      {/* Quotation Detail Modal */}
      <Modal isOpen={detailOpen} onClose={() => setDetailOpen(false)} title={`Quotation #${selectedQuotation?.quotation_number || ''}`} size="full"
        footer={selectedQuotation && (
          <>
            <Button variant="secondary" icon={Copy} onClick={handleRepeatOrder}>Repeat Order</Button>
            {selectedQuotation.status === 'draft' && (
              <>
                <Button variant="secondary" icon={Edit} onClick={openEditModal}>Edit Header</Button>
                <Button variant="success" icon={CheckCircle} onClick={() => setApproveOpen(true)}>Confirm Order</Button>
              </>
            )}
            {selectedQuotation.status === 'pending' && (
              <>
                <Button variant="secondary" icon={Edit} onClick={openEditModal}>Edit Header</Button>
                <Button variant="danger" icon={XCircle} onClick={() => setRejectOpen(true)}>Reject</Button>
                <Button variant="success" icon={CheckCircle} onClick={() => setApproveOpen(true)}>Approve</Button>
              </>
            )}
            {selectedQuotation.status === 'approved' && (
              <>
                <Button variant="secondary" icon={Download} onClick={() => handleDownload('customer')}>Customer PDF</Button>
                <Button variant="secondary" icon={Download} onClick={() => handleDownload('factory')}>Supervisor PDF</Button>
                <Button variant="secondary" icon={Download} onClick={() => handleDownload('production')}>Production PDF</Button>
                <Button variant="secondary" icon={FileSpreadsheet} onClick={async () => {
                  try {
                    const { data } = await quotationService.downloadExcel(selectedQuotation.id);
                    const url = URL.createObjectURL(data);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${selectedQuotation.quotation_number}.xlsx`;
                    a.click();
                  } catch { toast.error('Download failed.'); }
                }}>Excel</Button>
                {selectedQuotation.orders?.current_status === 'dispatched' && selectedQuotation.orders?.lr_attachments?.[0]?.file_url && (
                  <a href={selectedQuotation.orders.lr_attachments[0].file_url} target="_blank" rel="noopener noreferrer">
                    <Button variant="primary" icon={Download}>Download LR</Button>
                  </a>
                )}
              </>
            )}
          </>
        )}
      >
        {selectedQuotation && (
          <div className="space-y-6">
            {/* Status + Meta */}
            <div className="flex items-center gap-3">
              <Badge status={selectedQuotation.status} />
              <span className="text-sm text-text-secondary">Version v{selectedQuotation.version}</span>
            </div>

            {/* Customer Info */}
            <div className="bg-primary-50/40 border border-primary/10 rounded-lg p-4">
              <h3 className="text-primary font-bold text-sm mb-3">Customer Information</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div><span className="text-text-secondary">Customer:</span><p className="font-medium">{selectedQuotation.customer_name}</p></div>
                <div><span className="text-text-secondary">Contact:</span><p className="font-medium">{selectedQuotation.customer_contact || '-'}</p></div>
                <div><span className="text-text-secondary">Destination:</span><p className="font-medium">{selectedQuotation.destination || '-'}</p></div>
                <div><span className="text-text-secondary">Date:</span><p className="font-medium">{selectedQuotation.quotation_date ? format(new Date(selectedQuotation.quotation_date), 'dd MMM yyyy') : '-'}</p></div>
              </div>
            </div>

            {/* Product Rows Table */}
            <div className="overflow-x-auto">
              <table className="w-full border border-border rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-primary text-white">
                    {['Product', 'Pack Size', 'Qty', 'Bulk Rate', 'Cost/Pcs', 'Label/Pcs', 'Amount', 'GST', 'Total'].map((h) => (
                      <th key={h} className="px-3 py-2 text-xs font-semibold text-left">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const displayRows = selectedQuotation.order_type === 'bulk' && (!selectedQuotation.rows || selectedQuotation.rows.length === 0) && selectedQuotation.material_name 
                      ? [{
                          product_name: selectedQuotation.material_name,
                          pack_size_value: '',
                          pack_size_unit: selectedQuotation.material_unit,
                          total_pcs: selectedQuotation.quantity,
                          bulk_rate_per_ltr_kg: selectedQuotation.material_rate,
                          cost_per_pcs: selectedQuotation.material_rate,
                          components: [],
                          row_amount: selectedQuotation.subtotal,
                          gst_rate: selectedQuotation.gst_rate || 18,
                          row_total_with_gst: selectedQuotation.grand_total,
                        }] 
                      : (selectedQuotation.rows || []);

                    return displayRows.map((row, i) => {
                      const ld = row.label_snapshot;
                      const labelRate = (ld && ld.is_new_batch && !ld.withoutLabel) ? ld.rate_per_label : 0;
                      
                      return (
                      <React.Fragment key={i}>
                        <tr className={`border-b border-border ${i % 2 ? 'bg-surface-alt' : ''}`}>
                          <td className="px-3 py-2 text-sm">
                            <div className="font-medium">{row.products ? `${row.products.product_name} (${row.products.product_code})` : (row.packing_type || selectedQuotation.material_name || '-')}</div>
                            {row.container_variant && <div className="text-xs text-text-muted mt-0.5">Packing: {row.container_variant}</div>}
                          </td>
                          <td className="px-3 py-2 text-sm">{selectedQuotation.order_type === 'bulk' ? 'Bulk' : `${row.pack_size_value || ''}${row.pack_size_unit || ''}`}</td>
                          <td className="px-3 py-2 text-sm">{selectedQuotation.order_type === 'bulk' ? `${row.total_quantity_ltr_kg || ''} ${row.pack_size_unit || ''}`.trim() : row.total_pcs}</td>
                          <td className="px-3 py-2 text-sm">{formatINR(row.bulk_rate_per_ltr_kg)}</td>
                          <td className="px-3 py-2 text-sm">{formatINR(row.cost_per_pcs)}</td>
                          <td className="px-3 py-2 text-sm">{formatINR(labelRate)}</td>
                          <td className="px-3 py-2 text-sm font-medium">{formatINR(row.row_amount)}</td>
                          <td className="px-3 py-2 text-sm">{row.gst_rate}%</td>
                          <td className="px-3 py-2 text-sm font-bold">{formatINR(row.row_total_with_gst)}</td>
                        </tr>
                        {ld && ld.withoutLabel && (
                          <tr className={i % 2 ? 'bg-surface-alt' : ''}>
                            <td colSpan="9" className="px-3 py-2 border-b border-border">
                              <div className="p-2 border border-border rounded bg-surface-alt text-text-secondary text-sm flex justify-between items-center">
                                <div><span className="font-semibold text-text-primary">Without Label:</span> This product is ordered without a label.</div>
                              </div>
                            </td>
                          </tr>
                        )}
                        {ld && !ld.withoutLabel && (ld.is_new_batch || ld.include_in_quotation) && (
                          <tr className={i % 2 ? 'bg-surface-alt' : ''}>
                            <td colSpan="9" className="px-3 py-2 border-b border-border">
                              <div className={`p-3 border rounded ${ld.is_new_batch ? 'border-warning bg-warning-light/10' : 'border-success bg-success-light/10'}`}>
                                <div className="flex justify-between items-center mb-2">
                                  <h4 className="font-semibold text-xs">{ld.is_new_batch ? 'New Label Batch Required' : 'Label Inventory Status'}</h4>
                                  {ld.is_new_batch && <span className="font-bold text-primary text-xs">+ {formatINR(ld.current_batch_total)}</span>}
                                </div>
                                <table className="w-full text-xs text-left">
                                  <thead>
                                    <tr className="text-text-muted border-b">
                                      <th className="pb-1 font-medium">Pack Size</th>
                                      <th className="pb-1 font-medium text-right">Printed (Make)</th>
                                      <th className="pb-1 font-medium text-right">Used</th>
                                      <th className="pb-1 font-medium text-right">Closing Stock</th>
                                      {ld.is_new_batch && <th className="pb-1 font-medium text-right">Rate</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr>
                                      <td className="py-1">{ld.pack_size}</td>
                                      <td className="py-1 text-right">{ld.is_new_batch ? (ld.make_quantity || 0).toLocaleString() : '0'}</td>
                                      <td className="py-1 text-right text-error">{(ld.used_to_date || 0).toLocaleString()}</td>
                                      <td className="py-1 text-right font-medium">{(ld.closing_stock || 0).toLocaleString()}</td>
                                      {ld.is_new_batch && <td className="py-1 text-right">₹{ld.rate_per_label}</td>}
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    )});
                })()}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-72 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-text-secondary">Subtotal:</span><span className="font-medium">{formatINR(selectedQuotation.subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-text-secondary">GST:</span><span className="font-medium">{formatINR(selectedQuotation.total_gst)}</span></div>
                {(() => {
                  const labelTotal = (selectedQuotation.rows || []).reduce((acc, row) => {
                    const snap = row.label_snapshot;
                    return acc + (snap && snap.is_new_batch ? (snap.current_batch_total || snap.total_amount || 0) : 0);
                  }, 0);
                  if (labelTotal > 0) {
                    return (
                      <div className="flex justify-between text-sm"><span className="text-text-secondary">Labels Total:</span><span className="font-medium">{formatINR(labelTotal)}</span></div>
                    );
                  }
                  return null;
                })()}
                <div className="flex justify-between text-base font-bold border-t border-border pt-2 mt-2">
                  <span className="text-primary">Grand Total:</span>
                  <span className="text-primary">{formatINR(selectedQuotation.grand_total)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Approve Modal */}
      <Modal isOpen={approveOpen} onClose={() => setApproveOpen(false)} title="Approve Quotation"
        footer={<><Button variant="secondary" onClick={() => setApproveOpen(false)}>Cancel</Button><Button variant="success" loading={actionLoading} onClick={handleApprove}>Confirm Approve</Button></>}
      >
        <Input label="Admin Note (Optional)" type="textarea" value={adminNote} onChange={(e) => setAdminNote(e.target.value)} placeholder="Add note before approving..." rows={4} />
      </Modal>

      {/* Reject Modal */}
      <Modal isOpen={rejectOpen} onClose={() => setRejectOpen(false)} title="Reject Quotation"
        footer={<><Button variant="secondary" onClick={() => setRejectOpen(false)}>Cancel</Button><Button variant="danger" loading={actionLoading} onClick={handleReject}>Confirm Reject</Button></>}
      >
        <Input label="Rejection Comment" type="textarea" value={rejectComment} onChange={(e) => setRejectComment(e.target.value)} placeholder="Provide reason for rejection..." rows={4} required />
      </Modal>

      {/* Edit Header Modal */}
      <Modal isOpen={editOpen} onClose={() => setEditOpen(false)} title="Edit Quotation Header"
        footer={<><Button variant="secondary" onClick={() => setEditOpen(false)}>Cancel</Button><Button variant="primary" loading={actionLoading} onClick={handleEditSubmit}>Save Changes</Button></>}
      >
        <div className="space-y-4">
          <Input label="Customer Name" value={editForm.customer_name} onChange={(e) => setEditForm({...editForm, customer_name: e.target.value})} />
          <Input label="Destination" value={editForm.destination} onChange={(e) => setEditForm({...editForm, destination: e.target.value})} />
          <Input label="Transport Name" value={editForm.transport_name} onChange={(e) => setEditForm({...editForm, transport_name: e.target.value})} />
          <Input label="Grand Total (₹)" type="number" value={editForm.grand_total} onChange={(e) => setEditForm({...editForm, grand_total: parseFloat(e.target.value) || 0})} />
        </div>
      </Modal>
    </div>
  );
}

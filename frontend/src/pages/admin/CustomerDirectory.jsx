import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';
import { Plus, Search, Edit2, Trash2, Clock, Copy } from 'lucide-react';

import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import Table from '../../components/common/Table';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';

function CustomerDirectory() {
  const { user } = useAuth();
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [saving, setSaving] = useState(false);
  
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customerHistory, setCustomerHistory] = useState([]);
  const [customerLabels, setCustomerLabels] = useState([]);
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' or 'labels'
  const [historyCustomerName, setHistoryCustomerName] = useState('');
  const [selectedCustomerId, setSelectedCustomerId] = useState(null);

  const [formData, setFormData] = useState({
    customer_name: '', gst_pan: '', billing_address: '', contact_number: '', transport_name: '', destination: ''
  });

  const [addBatchOpen, setAddBatchOpen] = useState(false);
  const [productsList, setProductsList] = useState([]);
  const [batchData, setBatchData] = useState({
    product_id: '', pack_size: '', pack_type: 'bottle', quantity: '', rate_per_label: '', brand_name: ''
  });

  const fetchDetails = async (customer) => {
    setHistoryCustomerName(customer.customer_name);
    setSelectedCustomerId(customer.id);
    setActiveTab('orders');
    setHistoryOpen(true);
    setHistoryLoading(true);
    try {
      const [historyRes, labelsRes] = await Promise.all([
        api.get(`/customers/${customer.id}/history`),
        api.get(`/labels/customer/${customer.id}`)
      ]);
      setCustomerHistory(historyRes.data.data);
      setCustomerLabels(labelsRes.data.data || []);
    } catch (err) {
      toast.error('Failed to load customer details');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenAddBatch = async () => {
    setAddBatchOpen(true);
    setBatchData({ product_id: '', pack_size: '', pack_type: 'bottle', quantity: '', rate_per_label: '', brand_name: '' });
    if (productsList.length === 0) {
      try {
        const { data } = await api.get('/products');
        setProductsList(data.data);
      } catch (err) {
        toast.error('Failed to load products');
      }
    }
  };

  const handleAddBatchSubmit = async () => {
    if (!batchData.product_id || !batchData.pack_size || !batchData.quantity) {
      toast.error('Please fill required fields');
      return;
    }
    if (parseInt(batchData.quantity, 10) < 1000) {
      toast.error('Minimum batch quantity is 1000 labels.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/labels/inventory', {
        ...batchData,
        customer_id: selectedCustomerId,
        batch_quantity: parseInt(batchData.quantity, 10),
        rate_per_label: parseFloat(batchData.rate_per_label) || 0
      });
      toast.success('Label batch added!');
      setAddBatchOpen(false);
      // Refresh labels
      const { data } = await api.get(`/labels/customer/${selectedCustomerId}`);
      setCustomerLabels(data.data || []);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add batch');
    } finally {
      setSaving(false);
    }
  };

  const handleRepeatOrder = (historyItem) => {
    if (historyItem.product_code === '-') { // Bulk
      window.location.href = `/admin/create-bulk?repeatId=${historyItem.quotation_id}`;
    } else { // Product
      window.location.href = `/admin/create-quotation?repeatId=${historyItem.quotation_id}`;
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [search]);

  const fetchCustomers = async () => {
    try {
      const { data } = await api.get(`/customers?search=${search}`);
      setCustomers(data.data);
    } catch (err) {
      toast.error('Failed to load customers');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (customer = null) => {
    if (customer) {
      setEditingCustomer(customer);
      setFormData({ ...customer });
    } else {
      setEditingCustomer(null);
      setFormData({ customer_name: '', gst_pan: '', billing_address: '', contact_number: '', transport_name: '', destination: '' });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!formData.customer_name) {
      toast.error('Customer name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingCustomer) {
        await api.put(`/customers/${editingCustomer.id}`, formData);
        toast.success('Customer updated!');
      } else {
        await api.post('/customers', formData);
        toast.success('Customer added!');
      }
      setIsModalOpen(false);
      fetchCustomers();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Action failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this customer?')) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Customer deleted');
      fetchCustomers();
    } catch (err) {
      toast.error('Delete failed');
    }
  };

  const columns = [
    { key: 'customer_name', header: 'Customer Name', render: (c) => <span className="font-medium text-text-primary">{c.customer_name}</span> },
    { key: 'contact_number', header: 'Contact', render: (c) => c.contact_number || '-' },
    { key: 'gst_pan', header: 'GST / PAN', render: (c) => c.gst_pan || '-' },
    { key: 'transport_dest', header: 'Transport & Dest.', render: (c) => (
      <div className="text-sm">
        <div className="font-medium text-text-primary">{c.transport_name || '-'}</div>
        <div className="text-text-secondary">{c.destination}</div>
      </div>
    )},
    { key: 'actions', header: 'Actions', sortable: false, render: (c) => (
      <div className="flex items-center justify-end gap-2">
        <button onClick={(e) => { e.stopPropagation(); fetchDetails(c); }} className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-md transition-colors" title="View Customer Details"><Clock size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleOpenModal(c); }} className="p-1.5 text-primary-main hover:bg-primary-main/10 rounded-md transition-colors" title="Edit Customer"><Edit2 size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }} className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors" title="Delete Customer"><Trash2 size={16} /></button>
      </div>
    )}
  ];

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Customer Directory</h1>
          <p className="text-text-secondary mt-1">Manage client details for quick repeat orders</p>
        </div>
        <Button onClick={() => handleOpenModal()} icon={Plus}>Add Customer</Button>
      </div>

      <Table 
        columns={columns} 
        data={customers} 
        loading={loading} 
        searchPlaceholder="Search customers..." 
        onSearch={setSearch} 
        searchValue={search} 
      />

      {/* Add / Edit Modal */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        title={editingCustomer ? 'Edit Customer' : 'Add Customer'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleSubmit}>Save Customer</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Customer/Company Name" value={formData.customer_name} onChange={e => setFormData({...formData, customer_name: e.target.value})} required />
            <Input label="Contact Number" value={formData.contact_number} onChange={e => setFormData({...formData, contact_number: e.target.value})} />
          </div>
          <Input label="Billing Address" type="textarea" rows={2} value={formData.billing_address} onChange={e => setFormData({...formData, billing_address: e.target.value})} />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="GST / PAN No." value={formData.gst_pan} onChange={e => setFormData({...formData, gst_pan: e.target.value})} />
            <Input label="Transport Name" value={formData.transport_name} onChange={e => setFormData({...formData, transport_name: e.target.value})} />
            <Input label="Destination (with PIN)" value={formData.destination} onChange={e => setFormData({...formData, destination: e.target.value})} />
          </div>
        </div>
      </Modal>

      {/* Details Modal */}
      <Modal 
        isOpen={historyOpen} 
        onClose={() => setHistoryOpen(false)} 
        title={`Customer Details: ${historyCustomerName}`}
        size="lg"
        footer={<Button variant="secondary" onClick={() => setHistoryOpen(false)}>Close</Button>}
      >
        <div className="flex border-b border-border mb-4">
          <button 
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'orders' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            onClick={() => setActiveTab('orders')}
          >
            Order History
          </button>
          <button 
            className={`py-2 px-4 font-medium text-sm border-b-2 transition-colors ${activeTab === 'labels' ? 'border-primary text-primary' : 'border-transparent text-text-secondary hover:text-text-primary'}`}
            onClick={() => setActiveTab('labels')}
          >
            Label Inventory
          </button>
        </div>

        {activeTab === 'orders' && (
          <div className="overflow-x-auto">
            <table className="table w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 font-medium text-sm text-text-secondary">Date</th>
                  <th className="py-2 font-medium text-sm text-text-secondary">Order #</th>
                  <th className="py-2 font-medium text-sm text-text-secondary">Product</th>
                  <th className="py-2 font-medium text-sm text-text-secondary text-right">Quantity</th>
                  <th className="py-2 font-medium text-sm text-text-secondary text-center">Status</th>
                  <th className="py-2 font-medium text-sm text-text-secondary text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {historyLoading ? (
                  <tr><td colSpan="6" className="text-center py-8 text-text-secondary">Loading history...</td></tr>
                ) : customerHistory.length === 0 ? (
                  <tr><td colSpan="6" className="text-center py-8 text-text-secondary">No orders found for this customer.</td></tr>
                ) : (
                  customerHistory.map((h, i) => (
                    <tr key={`${h.id}-${i}`} className="border-b border-border hover:bg-surface-alt/30">
                      <td className="py-3 text-sm">{new Date(h.date).toLocaleDateString()}</td>
                      <td className="py-3 text-sm font-medium">{h.quotation_number}</td>
                      <td className="py-3 text-sm">
                        <div className="font-medium text-text-primary">{h.product_name}</div>
                        {h.product_code !== '-' && <div className="text-xs text-text-secondary">Code: {h.product_code}</div>}
                      </td>
                      <td className="py-3 text-sm text-right font-medium">{h.quantity} {h.quantity_unit}</td>
                      <td className="py-3 text-sm text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                          h.status === 'approved' ? 'bg-success/10 text-success' :
                          h.status === 'rejected' ? 'bg-error/10 text-error' :
                          'bg-warning/10 text-warning-dark'
                        }`}>
                          {h.status.charAt(0).toUpperCase() + h.status.slice(1)}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <button 
                          onClick={() => handleRepeatOrder(h)} 
                          className="p-1.5 text-primary-main hover:bg-primary-main/10 rounded-md transition-colors inline-flex items-center gap-1 text-xs font-medium"
                          title="Repeat this specific order"
                        >
                          <Copy size={14} /> Repeat
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {activeTab === 'labels' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-medium text-text-primary">Current Label Stock</h3>
              {user?.role === 'admin' && (
                <Button size="sm" icon={Plus} onClick={handleOpenAddBatch}>Add Label Batch</Button>
              )}
            </div>
            
            <div className="overflow-x-auto">
              <table className="table w-full text-left border-collapse border border-border rounded-lg">
                <thead className="bg-surface-alt">
                  <tr className="border-b border-border">
                    <th className="px-4 py-3 font-semibold text-xs text-text-secondary">Product</th>
                    <th className="px-4 py-3 font-semibold text-xs text-text-secondary">Pack Size</th>
                    <th className="px-4 py-3 font-semibold text-xs text-text-secondary">Available Stock</th>
                    <th className="px-4 py-3 font-semibold text-xs text-text-secondary">Make</th>
                    <th className="px-4 py-3 font-semibold text-xs text-text-secondary">Total Printed</th>
                    <th className="px-4 py-3 font-semibold text-xs text-text-secondary text-right">Used to Date</th>
                    <th className="px-4 py-3 font-semibold text-xs text-text-secondary text-right">Closing Stock</th>
                  </tr>
                </thead>
                <tbody>
                  {historyLoading ? (
                    <tr><td colSpan="7" className="text-center py-8 text-text-secondary">Loading labels...</td></tr>
                  ) : customerLabels.length === 0 ? (
                    <tr><td colSpan="7" className="text-center py-8 text-text-secondary">No label inventory found for this customer.</td></tr>
                  ) : (
                    customerLabels.map((l, i) => {
                      const displayClosingStock = (l.total_printed || 0) - (l.used_to_date || 0);
                      const colorClass = displayClosingStock > 200 ? 'text-success' : displayClosingStock > 0 ? 'text-warning-dark' : 'text-error';
                      return (
                        <tr key={`label-${i}`} className="border-b border-border hover:bg-surface-alt/30">
                          <td className="px-4 py-3 text-sm font-medium">{l.products?.product_name || '-'}</td>
                          <td className="px-4 py-3 text-sm">{l.pack_size} ({l.pack_type})</td>
                          <td className="px-4 py-3 text-sm">{l.open_stock?.toLocaleString() || '0'}</td>
                          <td className="px-4 py-3 text-sm">{l.make_quantity?.toLocaleString() || '0'}</td>
                          <td className="px-4 py-3 text-sm">{l.total_printed?.toLocaleString() || '0'}</td>
                          <td className="px-4 py-3 text-sm text-right text-text-secondary">{l.used_to_date?.toLocaleString() || '0'}</td>
                          <td className={`px-4 py-3 text-sm text-right font-bold ${colorClass}`}>{displayClosingStock.toLocaleString()}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Add Label Batch Modal */}
      <Modal
        isOpen={addBatchOpen}
        onClose={() => setAddBatchOpen(false)}
        title="Add Label Batch"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddBatchOpen(false)}>Cancel</Button>
            <Button variant="primary" loading={saving} onClick={handleAddBatchSubmit}>Save Batch</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Product <span className="text-red-500">*</span></label>
              <select className="input" value={batchData.product_id} onChange={e => setBatchData({...batchData, product_id: e.target.value})} required>
                <option value="">Select Product...</option>
                {productsList.map(p => (
                  <option key={p.id} value={p.id}>{p.product_name}</option>
                ))}
              </select>
            </div>
            <Input label="Brand Name" value={batchData.brand_name} onChange={e => setBatchData({...batchData, brand_name: e.target.value})} />
            
            <Input label="Pack Size (e.g. 500ml)" value={batchData.pack_size} onChange={e => setBatchData({...batchData, pack_size: e.target.value})} required />
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Pack Type</label>
              <select className="input" value={batchData.pack_type} onChange={e => setBatchData({...batchData, pack_type: e.target.value})}>
                <option value="bottle">Bottle</option>
                <option value="pouch">Pouch</option>
                <option value="drum">Drum</option>
                <option value="box">Box</option>
              </select>
            </div>
            
            <Input label="Quantity Printed" type="number" value={batchData.quantity} onChange={e => setBatchData({...batchData, quantity: e.target.value})} required />
            <Input label="Rate per Label (₹)" type="number" step="0.01" value={batchData.rate_per_label} onChange={e => setBatchData({...batchData, rate_per_label: e.target.value})} />
          </div>
        </div>
      </Modal>
    </div>
  );
}

export default CustomerDirectory;

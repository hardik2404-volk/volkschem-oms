import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import { useEffect, useState } from 'react';
import api from '../../services/api';
import toast from 'react-hot-toast';

export default function Step2CustomerDetails() {
  const { state, updateHeader } = useQuotation();
  const { user } = useAuth();
  const h = state.header;
  const [customers, setCustomers] = useState([]);

  // Auto-fill employee name on mount
  useEffect(() => {
    if (!h.employee_name && user?.full_name) {
      updateHeader('employee_name', user.full_name);
    }
  }, [user]);

  // Fetch customers
  useEffect(() => {
    api.get('/customers').then(res => setCustomers(res.data.data)).catch(err => console.error(err));
  }, []);

  const handleCustomerSelect = (e) => {
    const selectedId = e.target.value;
    if (!selectedId) return;
    const c = customers.find(x => x.id === selectedId);
    if (c) {
      updateHeader('customer_id', c.id);
      updateHeader('billing_name', c.customer_name);
      updateHeader('customer_name', c.customer_name);
      updateHeader('customer_contact', c.contact_number || '');
      updateHeader('gst_pan', c.gst_pan || '');
      updateHeader('billing_address', c.billing_address || '');
      updateHeader('transport_name', c.transport_name || '');
      updateHeader('destination', c.destination || '');
      toast.success('Customer details auto-filled!');
    }
  };

  const handleCustomerNameBlur = (val) => {
    if (!val) return;
    const c = customers.find(x => x.customer_name.trim().toLowerCase() === val.trim().toLowerCase());
    if (c) {
      // Auto fill only if currently empty to avoid overwriting user input
      let filled = false;
      if (!h.customer_id) { updateHeader('customer_id', c.id); filled = true; }
      if (!h.billing_name) { updateHeader('billing_name', c.customer_name); filled = true; }
      if (!h.customer_contact && c.contact_number) { updateHeader('customer_contact', c.contact_number); filled = true; }
      if (!h.gst_pan && c.gst_pan) { updateHeader('gst_pan', c.gst_pan); filled = true; }
      if (!h.billing_address && c.billing_address) { updateHeader('billing_address', c.billing_address); filled = true; }
      if (!h.transport_name && c.transport_name) { updateHeader('transport_name', c.transport_name); filled = true; }
      if (!h.destination && c.destination) { updateHeader('destination', c.destination); filled = true; }
      if (filled) toast.success('Customer details auto-filled!');
    }
  };

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      <div className="flex justify-between items-end mb-6">
        <div>
          <h2 className="text-xl font-bold text-text-primary mb-2">Customer & Order Details</h2>
          <p className="text-sm text-text-secondary">Enter customer information and delivery details</p>
        </div>
        <div className="w-64">
          <label className="block text-sm font-medium text-text-secondary mb-1">Quick Select Customer</label>
          <select className="input-field py-1.5 text-sm" onChange={handleCustomerSelect} defaultValue="">
            <option value="" disabled>-- Select Existing Customer --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.customer_name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-5">
        {/* Company Name */}
        {state.orderType === 'gujarat_brand' ? (
          <div className="p-3 bg-surface-alt border border-border rounded-lg">
            <p className="text-xs text-text-muted">Company Name</p>
            <p className="text-sm font-semibold text-text-primary">Volkschem Crop Science Pvt. Ltd.</p>
          </div>
        ) : (
          <Input
            label="Company / Billing Name"
            value={h.billing_name}
            onChange={(e) => updateHeader('billing_name', e.target.value)}
            placeholder="Enter client company name"
            required
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Employee Name" value={h.employee_name} onChange={(e) => updateHeader('employee_name', e.target.value)} required />
          <Input label="Customer Name" value={h.customer_name} onChange={(e) => updateHeader('customer_name', e.target.value)} onBlur={(e) => handleCustomerNameBlur(e.target.value)} required />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Customer Contact" value={h.customer_contact} onChange={(e) => updateHeader('customer_contact', e.target.value)} placeholder="+91 XXXXX XXXXX" />
          <Input label="GST / PAN Number" value={h.gst_pan} onChange={(e) => updateHeader('gst_pan', e.target.value)} placeholder="e.g. 24AAFCV2675N1ZU" />
        </div>

        <Input label="Billing Address" type="textarea" rows={2} value={h.billing_address} onChange={(e) => updateHeader('billing_address', e.target.value)} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {state.orderType === 'gujarat_brand' && (
            <Input label="Billing Name" value={h.billing_name} onChange={(e) => updateHeader('billing_name', e.target.value)} />
          )}
          <Input label="Transport Name" value={h.transport_name} onChange={(e) => updateHeader('transport_name', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Delivery Destination" value={h.destination} onChange={(e) => updateHeader('destination', e.target.value)} />
          <Input label="Pin Code" value={h.pin_code} onChange={(e) => updateHeader('pin_code', e.target.value)} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Label Company Name" value={h.label_company_name} onChange={(e) => updateHeader('label_company_name', e.target.value)} />
          <Input label="Name on Label" value={h.name_on_label} onChange={(e) => updateHeader('name_on_label', e.target.value)} />
        </div>

        <Input label="Quotation Date" type="date" value={h.quotation_date} onChange={(e) => updateHeader('quotation_date', e.target.value)} />

        <div className="flex items-center gap-2 mt-4">
          <input 
            type="checkbox" 
            id="saveCustomer" 
            className="w-4 h-4 text-primary bg-surface border-border rounded focus:ring-primary/50"
            checked={h.save_to_directory || false}
            onChange={(e) => updateHeader('save_to_directory', e.target.checked)}
          />
          <label htmlFor="saveCustomer" className="text-sm font-medium text-text-primary cursor-pointer">
            Save this customer to the Customer Directory
          </label>
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { bulkPriceService, quotationService } from '../services/dataService';
import Input from '../components/common/Input';
import Button from '../components/common/Button';
import { Search, Save, Send, Loader2, Plus, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

function formatINR(a) { return a == null ? '₹0' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(a); }

export default function BulkQuotationForm() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');
  const isViewMode = searchParams.get('view') === 'true';
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);

  const [form, setForm] = useState({
    customer_name: '', customer_contact: '', billing_address: '',
    transport_name: '', destination: '', quotation_date: new Date().toISOString().split('T')[0],
    notes: ''
  });

  const [rows, setRows] = useState([
    { id: Date.now(), material: null, query: '', quantity: '', gst_rate: '18', container_variant: '' }
  ]);

  useEffect(() => {
    let isMounted = true;
    
    import('../services/api').then(api => {
      api.default.get('/customers').then(res => {
        if (isMounted) setCustomers(res.data.data);
      }).catch(err => console.error(err));
    });

    bulkPriceService.getAll()
      .then(async ({ data }) => {
        const mats = data.data || [];
        if (isMounted) setMaterials(mats);
        
        if (editId || searchParams.get('repeatId')) {
          try {
            const targetId = editId || searchParams.get('repeatId');
            const res = await quotationService.getById(targetId);
            const q = res.data.data;
            if (q && isMounted) {
              setForm({
                customer_name: q.customer_name || '',
                customer_contact: q.customer_contact || '',
                billing_address: q.billing_address || '',
                transport_name: q.transport_name || '',
                destination: q.destination || '',
                quotation_date: q.quotation_date || new Date().toISOString().split('T')[0],
                notes: q.notes || '',
              });
              
              if (q.rows && q.rows.length > 0) {
                const loadedRows = q.rows.map((r, idx) => {
                  const matName = r.packing_type || r.product_name || q.material_name;
                  const mat = mats.find(m => m.material_name === matName);
                  return {
                    id: Date.now() + idx,
                    material: mat || { material_name: matName, rate_per_unit: r.bulk_rate_per_ltr_kg, unit: r.pack_size_unit },
                    query: '',
                    quantity: r.total_quantity_ltr_kg || q.quantity || '',
                    gst_rate: r.gst_rate?.toString() || q.gst_rate?.toString() || '18',
                    container_variant: r.container_variant || ''
                  };
                });
                setRows(loadedRows);
              } else if (q.material_name) {
                const mat = mats.find(m => m.material_name === q.material_name);
                setRows([{
                  id: Date.now(),
                  material: mat || { material_name: q.material_name, rate_per_unit: q.material_rate, unit: q.material_unit },
                  query: '',
                  quantity: q.quantity || '',
                  gst_rate: q.gst_rate?.toString() || '18',
                  container_variant: ''
                }]);
              }
            }
          } catch (e) {
            toast.error('Failed to load quotation');
          }
        }
      })
      .catch(() => { if (isMounted) setMaterials([]); })
      .finally(() => { if (isMounted) setLoading(false); });
      
    return () => { isMounted = false; };
  }, [editId]);

  const updateRow = (id, fieldOrUpdates, value) => {
    setRows(prev => prev.map(r => {
      if (r.id !== id) return r;
      if (typeof fieldOrUpdates === 'object') return { ...r, ...fieldOrUpdates };
      return { ...r, [fieldOrUpdates]: value };
    }));
  };

  const addRow = () => {
    setRows([...rows, { id: Date.now(), material: null, query: '', quantity: '', gst_rate: '18', container_variant: '' }]);
  };

  const removeRow = (id) => {
    if (rows.length > 1) {
      setRows(rows.filter(r => r.id !== id));
    }
  };

  const totals = rows.reduce((acc, row) => {
    if (!row.material) return acc;
    const qty = parseFloat(row.quantity) || 0;
    const rate = row.material?.rate_per_unit || 0;
    const amount = qty * rate;
    const gstRate = parseFloat(row.gst_rate) || 18;
    const gstAmount = amount * (gstRate / 100);
    return {
      amount: acc.amount + amount,
      gstAmount: acc.gstAmount + gstAmount,
      grandTotal: acc.grandTotal + amount + gstAmount
    };
  }, { amount: 0, gstAmount: 0, grandTotal: 0 });

  const handleSubmit = async (status) => {
    const invalidRow = rows.find(r => !r.material || !r.quantity || parseFloat(r.quantity) <= 0);
    if (invalidRow) { toast.error('All rows must have a material and valid quantity.'); return; }
    if (!form.customer_name) { toast.error('Customer name is required.'); return; }
    
    setSaving(true);
    try {
      const payload = {
        order_type: 'bulk',
        status,
        employee_name: user?.full_name,
        customer_name: form.customer_name,
        customer_contact: form.customer_contact,
        billing_address: form.billing_address,
        transport_name: form.transport_name,
        destination: form.destination,
        quotation_date: form.quotation_date,
        notes: form.notes,
        subtotal: totals.amount,
        total_gst: totals.gstAmount,
        grand_total: totals.grandTotal,
        rows: rows.map((r, i) => {
          const qty = parseFloat(r.quantity) || 0;
          const rate = r.material?.rate_per_unit || 0;
          const amount = qty * rate;
          const gstRate = parseFloat(r.gst_rate) || 18;
          return {
            row_number: i + 1,
            packing_type: r.material.material_name,
            container_variant: r.container_variant || null,
            pack_size_value: 1,
            pack_size_unit: r.material.unit,
            total_quantity_ltr_kg: qty,
            total_pcs: 0,
            bulk_rate_per_ltr_kg: rate,
            bulk_material_cost_per_pcs: rate,
            cost_per_pcs: rate,
            gst_rate: gstRate,
            row_amount: amount,
            gst_amount: amount * (gstRate / 100),
            row_total_with_gst: amount + (amount * (gstRate / 100))
          };
        })
      };

      if (editId) {
        await quotationService.update(editId, payload);
      } else {
        await quotationService.create(payload);
      }
      toast.success(status === 'draft' ? 'Saved as draft.' : 'Submitted for approval!');
      navigate('/employee/my-orders');
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <h1 className="text-2xl font-bold text-text-primary mb-2">Bulk Material Quotation</h1>
      <p className="text-sm text-text-secondary mb-6">Simple rate × quantity quotation for raw materials</p>

      {/* Rows */}
      <div className="mb-6 space-y-4">
        {rows.map((row, index) => {
          const filtered = materials.filter((m) => m.material_name?.toLowerCase().includes(row.query.toLowerCase()));
          const qty = parseFloat(row.quantity) || 0;
          const rate = row.material?.rate_per_unit || 0;
          
          return (
            <div key={row.id} className="p-4 bg-white border border-border rounded-xl shadow-sm relative">
              {rows.length > 1 && !isViewMode && (
                <button onClick={() => removeRow(row.id)} className="absolute top-4 right-4 text-error hover:bg-error-light p-1.5 rounded-lg transition-colors">
                  <Trash2 size={16} />
                </button>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  {!isViewMode && !row.material ? (
                    <>
                      <label className="text-sm font-medium text-text-primary mb-1 block">Select Material <span className="text-error">*</span></label>
                      <div className="relative">
                        <Search size={16} className="absolute left-3 top-2.5 text-text-muted" />
                        <input type="text" value={row.query} onChange={(e) => updateRow(row.id, 'query', e.target.value)}
                          placeholder="Search bulk material..."
                          className="w-full pl-9 pr-4 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-lighter/40 focus:border-primary-lighter" />
                      </div>
                      {row.query && (
                        <div className="mt-1 max-h-40 overflow-y-auto border border-border rounded-lg bg-white shadow-card absolute z-10 w-[calc(100%-2rem)] md:w-auto">
                          {loading ? <div className="p-3 flex justify-center"><Loader2 size={18} className="animate-spin text-primary" /></div> :
                            filtered.map((m) => (
                              <button key={m.id} onClick={() => updateRow(row.id, { material: m, query: '' })}
                                className="w-full px-3 py-2 text-left text-sm hover:bg-primary-50 flex justify-between">
                                <span>{m.material_name}</span>
                                <span className="font-semibold text-primary">₹{m.rate_per_unit?.toLocaleString('en-IN')} / {m.unit === 'kg' ? 'Kg' : 'Ltr'}</span>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col h-full justify-end">
                      <label className="text-sm font-medium text-text-primary mb-1 block">Selected Material</label>
                      <div className="p-2 bg-primary-50 border border-primary/20 rounded-lg flex justify-between items-center group">
                        <span className="text-sm font-medium text-primary">{row.material?.material_name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-primary">₹{rate?.toLocaleString('en-IN')} / {row.material?.unit === 'kg' ? 'Kg' : 'Ltr'}</span>
                          {!isViewMode && (
                            <button onClick={() => updateRow(row.id, 'material', null)} className="text-primary hover:text-primary-light text-xs underline opacity-0 group-hover:opacity-100 transition-opacity">Change</button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                
                <div className="md:col-span-3 flex flex-col justify-end">
                  <Input label={`Quantity (${row.material?.unit === 'kg' ? 'Kg' : 'Ltr'})`} type="number" value={row.quantity} onChange={(e) => updateRow(row.id, 'quantity', e.target.value)} required />
                </div>
                <div className="md:col-span-3 flex flex-col justify-end">
                  <Input label="GST Rate (%)" type="number" value={row.gst_rate} onChange={(e) => updateRow(row.id, 'gst_rate', e.target.value)} />
                </div>
              </div>

              {/* Packing Row */}
              {row.material && (
                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4 pt-4 border-t border-border/50">
                  <div className="md:col-span-12">
                    <Input label="Packing Type (e.g. 25kg Bag, Drum)" value={row.container_variant} onChange={(e) => updateRow(row.id, 'container_variant', e.target.value)} placeholder="Leave blank if none" />
                  </div>
                </div>
              )}
            </div>
          );
        })}

        {!isViewMode && (
          <Button variant="outline" icon={Plus} onClick={addRow} className="w-full border-dashed">
            Add Another Material
          </Button>
        )}
      </div>

      {/* Customer Details */}
      <div className="flex justify-between items-end mb-4">
        <h2 className="text-lg font-bold text-text-primary">Customer Details</h2>
        <div className="w-64">
          <label className="block text-sm font-medium text-text-secondary mb-1">Quick Select Customer</label>
          <select className="input-field py-1.5 text-sm" defaultValue="" onChange={(e) => {
            const c = customers.find(x => x.id === e.target.value);
            if (c) {
              setForm({
                ...form,
                customer_name: c.customer_name,
                customer_contact: c.contact_number || '',
                billing_address: c.billing_address || '',
                transport_name: c.transport_name || '',
                destination: c.destination || ''
              });
              toast.success('Customer auto-filled!');
            }
          }}>
            <option value="" disabled>-- Select Existing Customer --</option>
            {customers.map(c => (
              <option key={c.id} value={c.id}>{c.customer_name}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Input label="Customer Name" value={form.customer_name} 
            onChange={e => setForm({...form, customer_name: e.target.value})} 
            onBlur={e => {
              const val = e.target.value;
              if (!val) return;
              const c = customers.find(x => x.customer_name.trim().toLowerCase() === val.trim().toLowerCase());
              if (c) {
                let filled = false;
                const newForm = { ...form };
                if (!newForm.customer_contact && c.contact_number) { newForm.customer_contact = c.contact_number; filled = true; }
                if (!newForm.billing_address && c.billing_address) { newForm.billing_address = c.billing_address; filled = true; }
                if (!newForm.transport_name && c.transport_name) { newForm.transport_name = c.transport_name; filled = true; }
                if (!newForm.destination && c.destination) { newForm.destination = c.destination; filled = true; }
                if (filled) { setForm(newForm); toast.success('Customer details auto-filled!'); }
              }
            }}
            required />
          <Input label="Contact" value={form.customer_contact} onChange={(e) => setForm({ ...form, customer_contact: e.target.value })} />
        </div>
        <Input label="Billing Address" type="textarea" rows={2} value={form.billing_address} onChange={(e) => setForm({ ...form, billing_address: e.target.value })} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Transport Name" value={form.transport_name} onChange={(e) => setForm({ ...form, transport_name: e.target.value })} />
          <Input label="Destination" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Date" type="date" value={form.quotation_date} onChange={(e) => setForm({ ...form, quotation_date: e.target.value })} />
        </div>
        <Input label="Notes" type="textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
      </div>

      {/* Totals */}
      {totals.amount > 0 && (
        <div className="p-5 bg-primary-50 border border-primary/20 rounded-xl mb-6">
          <div className="flex justify-between text-sm mb-1"><span>Subtotal:</span><span className="font-semibold">{formatINR(totals.amount)}</span></div>
          <div className="flex justify-between text-sm mb-1"><span>Total GST:</span><span className="font-semibold">{formatINR(totals.gstAmount)}</span></div>
          <hr className="border-primary/20 my-2" />
          <div className="flex justify-between text-lg font-bold text-primary"><span>Grand Total:</span><span>{formatINR(totals.grandTotal)}</span></div>
        </div>
      )}

      {/* Buttons */}
      {!isViewMode && (
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
          <Button variant="secondary" icon={Save} onClick={() => handleSubmit('draft')} loading={saving}>Save Draft</Button>
          <Button variant="warning" icon={Send} onClick={() => handleSubmit('pending')} loading={saving}>Submit to Admin</Button>
        </div>
      )}
    </div>
  );
}

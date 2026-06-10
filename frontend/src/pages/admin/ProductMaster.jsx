import { useState, useEffect } from 'react';
import { productService } from '../../services/dataService';
import Table from '../../components/common/Table';
import Badge from '../../components/common/Badge';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import Input from '../../components/common/Input';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const PACKING_TYPES = ['Bottle', 'Ampoule', 'Pouch', 'Bucket', 'Jar/Dabba', 'Drum'];

export default function ProductMaster() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    product_name: '', product_code: '', technical_combination: '',
    bulk_material_rate: '', rate_unit: 'ltr', order_type: 'gujarat_brand',
    gst_rate: '18', packing_types: [],
  });

  const fetchProducts = () => {
    setLoading(true);
    productService.getAll()
      .then(({ data }) => setProducts(data.data || []))
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchProducts(); }, []);

  const openAdd = () => {
    setEditing(null);
    setForm({ product_name: '', product_code: '', technical_combination: '', bulk_material_rate: '', rate_unit: 'ltr', order_type: 'gujarat_brand', gst_rate: '18', packing_types: [] });
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      product_name: product.product_name || '',
      product_code: product.product_code || '',
      technical_combination: product.technical_combination || '',
      bulk_material_rate: product.bulk_rate_per_ltr_kg || '',
      rate_unit: product.rate_unit || 'ltr',
      order_type: product.order_type || 'gujarat_brand',
      gst_rate: product.gst_rate?.toString() || '18',
      packing_types: product.available_packing_types || [],
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!form.product_name.trim()) { toast.error('Product name is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        bulk_rate_per_ltr_kg: parseFloat(form.bulk_material_rate) || 0,
        gst_rate: parseFloat(form.gst_rate) || 0,
        available_packing_types: form.packing_types,
      };
      // Remove the old frontend-specific keys so they aren't sent to the backend
      delete payload.bulk_material_rate;
      delete payload.packing_types;

      if (editing) {
        await productService.update(editing.id, payload);
        toast.success('Product updated.');
      } else {
        await productService.create(payload);
        toast.success('Product added.');
      }
      setModalOpen(false);
      fetchProducts();
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Permanently delete this product?')) return;
    try {
      await productService.delete(id);
      toast.success('Product deleted.');
      fetchProducts();
    } catch { /* handled */ }
  };

  const togglePacking = (type) => {
    setForm((f) => ({
      ...f,
      packing_types: f.packing_types.includes(type) ? f.packing_types.filter((t) => t !== type) : [...f.packing_types, type],
    }));
  };

  const columns = [
    { key: 'product_name', header: 'Product Name', accessor: 'product_name' },
    { key: 'product_code', header: 'Product ID', render: (r) => <span className="font-medium text-text-secondary">{r.product_code || '-'}</span> },
    { key: 'technical_combination', header: 'Technical Combination', render: (r) => <span className="text-xs text-text-secondary max-w-[200px] truncate block">{r.technical_combination || '-'}</span> },
    { key: 'bulk_material_rate', header: 'Bulk Material Rate (₹/Ltr or Kg)', render: (r) => <span className="font-medium">{r.bulk_rate_per_ltr_kg?.toLocaleString('en-IN') || '-'}</span> },
    { key: 'order_type', header: 'Packing Label Type', render: (r) => <Badge status={r.order_type} /> },
    { key: 'packing_types', header: 'Pack Sizes', render: (r) => (
      <div className="flex flex-wrap gap-1">
        {(r.available_packing_types || []).map((p) => (
          <span key={p} className="px-2 py-0.5 bg-surface-alt text-text-secondary text-xs rounded-md border border-border">{p}</span>
        ))}
      </div>
    )},
    { key: 'updated_at', header: 'Updated', render: (r) => r.updated_at ? new Date(r.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '-' },
    { key: 'actions', header: 'Actions', sortable: false, render: (r) => (
      <div className="flex gap-1">
        <button onClick={(e) => { e.stopPropagation(); openEdit(r); }} className="p-1.5 hover:bg-surface-alt rounded-md text-text-secondary hover:text-primary transition-colors"><Pencil size={16} /></button>
        <button onClick={(e) => { e.stopPropagation(); handleDelete(r.id); }} className="p-1.5 hover:bg-error-light rounded-md text-text-secondary hover:text-error transition-colors"><Trash2 size={16} /></button>
      </div>
    )},
  ];

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Product Master</h1>
        </div>
        <Button variant="warning" icon={Plus} onClick={openAdd}>Add New Product</Button>
      </div>

      <Table columns={columns} data={products} loading={loading} searchPlaceholder="Search by name or technical..." />

      <Modal isOpen={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Product' : 'Add New Product'} size="lg"
        footer={<><Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button><Button loading={saving} onClick={handleSave}>{editing ? 'Update' : 'Add Product'}</Button></>}
      >
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input label="Product Name" value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} required />
            <Input label="Product ID" value={form.product_code} onChange={(e) => setForm({ ...form, product_code: e.target.value })} required />
          </div>
          <Input label="Technical Combination" type="textarea" rows={2} value={form.technical_combination} onChange={(e) => setForm({ ...form, technical_combination: e.target.value })} />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Input label="Bulk Material Rate" type="number" value={form.bulk_material_rate} onChange={(e) => setForm({ ...form, bulk_material_rate: e.target.value })} />
            <Input label="Rate Unit" type="select" value={form.rate_unit} onChange={(e) => setForm({ ...form, rate_unit: e.target.value })} options={[{ value: 'ltr', label: 'Per Litre' }, { value: 'kg', label: 'Per Kg' }]} />
            <Input label="GST Rate (%)" type="number" step="0.01" min="0" max="100" value={form.gst_rate} onChange={(e) => setForm({ ...form, gst_rate: e.target.value })} />
          </div>
          <Input label="Order Type" type="select" value={form.order_type} onChange={(e) => setForm({ ...form, order_type: e.target.value })} options={[{ value: 'gujarat_brand', label: 'Gujarat Brand' }, { value: 'third_party', label: 'Third Party' }]} />
          <div>
            <label className="text-sm font-medium text-text-primary mb-2 block">Packing Types</label>
            <div className="flex flex-wrap gap-2">
              {PACKING_TYPES.map((type) => (
                <button key={type} type="button" onClick={() => togglePacking(type)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${form.packing_types.includes(type) ? 'bg-primary text-white border-primary' : 'bg-white text-text-secondary border-border hover:border-primary-lighter'}`}>
                  {type}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

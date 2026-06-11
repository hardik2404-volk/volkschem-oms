import { useState, useEffect, useCallback } from 'react';
import { costSheetService } from '../../services/dataService';
import { InlineLoader } from '../../components/common/Loader';
import { Check, X, AlertTriangle, Plus, Trash2, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

const DEFAULT_CATEGORIES = [
  'Bottles', 'Ampoules', 'Labels', 'Pouches', 'Cartons',
  'FBB Boxes', 'Trays', 'Inner Boxes', 'Outer Boxes',
  'Measuring Caps', 'Shrink Caps', 'Buckets', 'Drums', 'Jars',
];

const EMPTY_FORM = { item_name: '', size: '', rate: '' };

export default function CostSheetManager() {
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [activeTab, setActiveTab] = useState(DEFAULT_CATEGORIES[0]);
  const [rates, setRates] = useState([]);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const isReadOnly = user?.role === 'employee';

  // Edit state
  const [editingId, setEditingId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [saving, setSaving] = useState(false);

  // Add new item state
  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_FORM);
  const [addErrors, setAddErrors] = useState({});
  const [adding, setAdding] = useState(false);

  // Add category state
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Delete confirm state
  const [deletingId, setDeletingId] = useState(null);

  const fetchRates = useCallback((category) => {
    setLoading(true);
    setEditingId(null);
    setShowAddForm(false);
    setAddForm(EMPTY_FORM);
    costSheetService.getRatesByCategory(category.toLowerCase().replace(/ /g, '_'))
      .then(({ data }) => setRates(data.data || []))
      .catch(() => { setRates([]); toast.error('Failed to load rates.'); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRates(activeTab); }, [activeTab]);

  useEffect(() => {
    // Fetch all rates once on mount to discover any custom categories in the DB
    costSheetService.getAll().then(({ data }) => {
      const allRates = data.data || [];
      const dbCategories = [...new Set(allRates.map(r => r.category))];
      // Format dbCategories (e.g., 'custom_boxes' -> 'Custom Boxes')
      const formattedDbCats = dbCategories.map(c => 
        c.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
      );
      
      const merged = [...new Set([...DEFAULT_CATEGORIES, ...formattedDbCats])];
      setCategories(merged);
    }).catch(() => {});
  }, []);

  const handleAddCategory = () => {
    const trimmed = newCategory.trim();
    if (!trimmed) { setShowAddCategory(false); return; }
    
    // Capitalize each word
    const formatted = trimmed.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
    
    if (!categories.includes(formatted)) {
      setCategories((prev) => [...prev, formatted]);
    }
    setActiveTab(formatted);
    setNewCategory('');
    setShowAddCategory(false);
  };

  // ── EDIT ──
  const startEdit = (item) => { setEditingId(item.id); setEditValue(item.rate?.toString() || ''); };
  const cancelEdit = () => { setEditingId(null); setEditValue(''); };

  const saveEdit = async (id) => {
    if (!editValue || isNaN(editValue)) { toast.error('Please enter a valid rate.'); return; }
    setSaving(true);
    try {
      await costSheetService.update(id, { rate: parseFloat(editValue) });
      toast.success('Rate updated. Only new quotations will use this rate.');
      setEditingId(null);
      fetchRates(activeTab);
    } catch { /* handled */ }
    finally { setSaving(false); }
  };

  // ── ADD ──
  const validateAddForm = () => {
    const errs = {};
    if (!addForm.item_name.trim()) errs.item_name = 'Item name is required.';
    if (!addForm.size.trim()) errs.size = 'Size is required (e.g. 500ml, 1Kg).';
    if (!addForm.rate || isNaN(addForm.rate) || parseFloat(addForm.rate) < 0) errs.rate = 'Valid rate required.';
    setAddErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!validateAddForm()) return;
    setAdding(true);
    try {
      await costSheetService.create({
        category: activeTab.toLowerCase().replace(/ /g, '_'),
        item_name: addForm.item_name.trim(),
        size: addForm.size.trim(),
        rate: parseFloat(addForm.rate),
      });
      toast.success('Item added to cost sheet.');
      setShowAddForm(false);
      setAddForm(EMPTY_FORM);
      setAddErrors({});
      fetchRates(activeTab);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to add item.');
    } finally {
      setAdding(false);
    }
  };

  // ── DELETE ──
  const handleDelete = async (id) => {
    setDeletingId(id);
    try {
      await costSheetService.delete(id);
      toast.success('Item deleted from cost sheet.');
      fetchRates(activeTab);
    } catch (err) {
      toast.error(err?.response?.data?.message || 'Failed to delete item.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Cost Sheet {isReadOnly ? 'Viewer' : 'Manager'}</h1>
          <p className="text-sm text-text-secondary mt-0.5">View {isReadOnly ? '' : ', edit, add, or delete '}component rates by category</p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => { setShowAddForm((v) => !v); setAddForm(EMPTY_FORM); setAddErrors({}); }}
            className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-primary-dark transition-colors"
          >
            <Plus size={16} />
            Add Item
          </button>
        )}
      </div>

      {/* Warning */}
      {!isReadOnly && (
        <div className="flex items-start gap-3 p-3 mb-4 bg-warning-light border border-warning/20 rounded-lg">
          <AlertTriangle size={16} className="text-warning flex-shrink-0 mt-0.5" />
          <p className="text-sm text-warning">
            Changing or deleting rates only affects <strong>new quotations</strong>. Existing approved quotations keep their original rates.
          </p>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex flex-wrap items-center gap-1 mb-4 bg-white rounded-lg border border-border p-1">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveTab(cat)}
            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
              activeTab === cat ? 'bg-primary text-white' : 'text-text-secondary hover:bg-surface-alt'
            }`}
          >
            {cat}
          </button>
        ))}
        

        {!isReadOnly && (
          showAddCategory ? (
            <div className="flex items-center ml-2 bg-surface-alt rounded border border-primary/30 px-1 py-1">
              <input 
                type="text" 
                autoFocus
                className="text-sm bg-transparent border-none focus:outline-none focus:ring-0 w-32 px-2 py-1"
                placeholder="Category Name"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
              />
              <button onClick={handleAddCategory} className="text-success hover:bg-success-light p-1 rounded">
                <Check size={16} />
              </button>
              <button onClick={() => { setShowAddCategory(false); setNewCategory(''); }} className="text-text-muted hover:text-error p-1 rounded">
                <X size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => setShowAddCategory(true)}
              className="px-3 py-2 text-sm font-medium rounded-md text-primary hover:bg-primary/10 transition-colors flex items-center gap-1 ml-1"
              title="Add Custom Category"
            >
              <Plus size={16} />
            </button>
          )
        )}
      </div>

      {/* ── Add New Item Form (inline panel) ── */}
      {showAddForm && (
        <div className="mb-4 bg-white border border-primary/30 rounded-xl overflow-hidden">
          <div className="px-5 py-3 border-b border-border bg-primary/5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-primary">Add New Item — {activeTab}</h3>
            <button onClick={() => setShowAddForm(false)} className="text-text-muted hover:text-text-primary">
              <X size={16} />
            </button>
          </div>
          <form onSubmit={handleAdd} className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4 items-start">
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Item Name *</label>
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-lighter ${addErrors.item_name ? 'border-error' : 'border-border'}`}
                placeholder="e.g. IMIDA Bottle"
                value={addForm.item_name}
                onChange={(e) => { setAddForm({ ...addForm, item_name: e.target.value }); setAddErrors({ ...addErrors, item_name: '' }); }}
              />
              {addErrors.item_name && <p className="text-xs text-error mt-1">{addErrors.item_name}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Size / Pack *</label>
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-lighter ${addErrors.size ? 'border-error' : 'border-border'}`}
                placeholder="e.g. 500ml, 1Kg, 20ml"
                value={addForm.size}
                onChange={(e) => { setAddForm({ ...addForm, size: e.target.value }); setAddErrors({ ...addErrors, size: '' }); }}
              />
              {addErrors.size && <p className="text-xs text-error mt-1">{addErrors.size}</p>}
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-secondary mb-1">Rate (₹) *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-primary-lighter ${addErrors.rate ? 'border-error' : 'border-border'}`}
                placeholder="0.00"
                value={addForm.rate}
                onChange={(e) => { setAddForm({ ...addForm, rate: e.target.value }); setAddErrors({ ...addErrors, rate: '' }); }}
              />
              {addErrors.rate && <p className="text-xs text-error mt-1">{addErrors.rate}</p>}
            </div>
            <div className="sm:col-span-3 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowAddForm(false); setAddForm(EMPTY_FORM); setAddErrors({}); }}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg text-text-secondary hover:bg-surface-alt"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={adding}
                className="inline-flex items-center gap-2 bg-primary text-white text-sm font-semibold px-5 py-2 rounded-lg hover:bg-primary-dark disabled:opacity-60"
              >
                {adding ? 'Saving...' : <><Check size={15} /> Save Item</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ── Rates Table ── */}
      <div className="bg-white rounded-xl border border-border overflow-hidden">
        {loading ? (
          <InlineLoader text="Loading rates..." />
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-surface-alt">
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Item Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Size</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Rate (₹)</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-secondary uppercase">Last Updated</th>
                {!isReadOnly && <th className="px-4 py-3 text-center text-xs font-semibold text-text-secondary uppercase w-32">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rates.length === 0 ? (
                <tr>
                  <td colSpan={isReadOnly ? 4 : 5} className="px-4 py-10 text-center text-text-muted text-sm">
                    No rates found for <strong>{activeTab}</strong>.{' '}
                    {!isReadOnly && <button className="text-primary hover:underline" onClick={() => setShowAddForm(true)}>Add the first one</button>}
                  </td>
                </tr>
              ) : (
                rates.map((item, i) => (
                  <tr key={item.id} className={`border-b border-border last:border-b-0 hover:bg-surface-alt/50 transition-colors ${i % 2 ? 'bg-surface-dark/30' : ''}`}>
                    <td className="px-4 py-3 text-sm font-medium text-text-primary">{item.item_name || item.component_name || '—'}</td>
                    <td className="px-4 py-3 text-sm text-text-secondary">{item.size || item.pack_size || '—'}</td>
                    <td className="px-4 py-3 text-sm">
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="w-24 px-2 py-1 border border-primary-lighter rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-lighter"
                            autoFocus
                            onKeyDown={(e) => { if (e.key === 'Enter') saveEdit(item.id); if (e.key === 'Escape') cancelEdit(); }}
                          />
                          <button onClick={() => saveEdit(item.id)} disabled={saving} className="text-success hover:bg-success-light p-1.5 rounded-md transition-colors">
                            <Check size={15} />
                          </button>
                          <button onClick={cancelEdit} className="text-text-muted hover:bg-surface-alt p-1.5 rounded-md transition-colors">
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <span className="font-semibold">₹ {item.rate?.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-text-secondary">
                      {item.updated_at ? new Date(item.updated_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </td>
                    {!isReadOnly && (
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {editingId !== item.id && (
                            <button
                              onClick={() => startEdit(item)}
                              className="px-3 py-1.5 text-xs font-medium text-primary border border-primary/30 rounded-md hover:bg-primary/5 transition-colors"
                            >
                              Edit
                            </button>
                          )}
                          <button
                            onClick={() => {
                              if (window.confirm(`Delete "${item.item_name || item.component_name} — ${item.size || item.pack_size}"? This cannot be undone.`)) {
                                handleDelete(item.id);
                              }
                            }}
                            disabled={deletingId === item.id}
                            className="p-1.5 text-error hover:bg-error-light rounded-md transition-colors disabled:opacity-50"
                            title="Delete item"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>

      {/* Summary */}
      {!loading && rates.length > 0 && (
        <p className="text-xs text-text-muted mt-2 text-right">{rates.length} item{rates.length !== 1 ? 's' : ''} in {activeTab}</p>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { useQuotation } from '../../context/QuotationContext';
import api from '../../services/api';
import { PackageSearch, CheckCircle2, AlertTriangle, Info, ChevronDown, ChevronUp } from 'lucide-react';
import Input from '../../components/common/Input';

export default function PMManagementBlock({ rowIndex, row }) {
  const { state, getPMDataForRow, updatePMDataForRow } = useQuotation();
  const pmData = getPMDataForRow(rowIndex) || {};
  
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const customerId = state.header?.customer_id;
  const productId = state.product?.id;
  const packSize = `${row?.packSizeValue}${row?.packSizeUnit}`;
  const packType = row?.packingType;
  const totalPcs = row?.totalPcs || 0;

  useEffect(() => {
    if (!customerId || !productId || !packSize || !packType || totalPcs === 0) return;
    
    let isMounted = true;
    const fetchInventory = async () => {
      setLoading(true);
      try {
        const res = await api.get(`/pm/inventory/${customerId}/${productId}/${packSize}?packType=${packType}&requiredPcs=${totalPcs}`);
        if (isMounted) {
          const inv = res.data.data;
          setData(inv);
          
          const isNewBatch = inv.isFirstOrder || !inv.sufficient;
          const shortfall = inv.shortfall || 0;
          const minQty = isNewBatch ? Math.max(1000, shortfall) : 0;
          
          let defaultRate = 0;
          try {
            const rateRes = await api.get('/cost-sheet');
            const allRates = rateRes.data.data.rates || [];
            const getPMCategory = (pt) => {
              switch(pt) {
                case 'Bottle': return ['bottles', 'labels'];
                case 'Ampoule': return ['ampoules', 'labels'];
                case 'Jar/Dabba': return ['jars'];
                case 'Pouch': return ['pouches'];
                case 'Bucket': return ['buckets'];
                case 'Drum': return ['drums'];
                default: return ['labels'];
              }
            };
            const pmCats = getPMCategory(packType);
            const pmRates = allRates.filter(r => pmCats.includes(r.category));
            const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
            const nSize = norm(packSize);
            const variantPM = packType === 'Ampoule' ? '' : (state.packingVariant || '');
            
            let match = pmRates.find(r => norm(r.size) === nSize && 
                ((variantPM && norm(r.item_name) === norm(variantPM)) || 
                 (variantPM && norm(variantPM).includes(norm(r.item_name))) || 
                 norm(r.item_name).includes('label') || 
                 norm(r.item_name) === 'pm'));
            
            if (!match && pmRates.length > 0) match = pmRates.find(r => norm(r.size) === nSize && norm(r.item_name).includes('label'));
            if (!match && pmRates.length > 0) match = pmRates.find(r => norm(r.size) === nSize);
            
            console.log('--- PM FETCH TRACE ---');
            console.log('nSize:', nSize, 'packType:', packType, 'pmCats:', pmCats);
            console.log('pmRates:', pmRates);
            console.log('match found:', match);

            if (match) defaultRate = match.rate;
          } catch (err) {
            console.error("Failed to fetch default pm rate:", err);
          }

          const currentData = getPMDataForRow(rowIndex) || {};
          const isSamePackSize = currentData.packSize === packSize;
          const isSamePackType = currentData.packType === packType;
          const initialRate = (isSamePackSize && isSamePackType && currentData.ratePerPM !== undefined && currentData.ratePerPM !== '') 
            ? currentData.ratePerPM 
            : defaultRate;
          const initialGstRate = currentData.gstRate !== undefined ? currentData.gstRate : 18;
          
          const amount = (isNewBatch ? minQty : 0) * (parseFloat(initialRate) || 0);
          const gst = amount * (initialGstRate / 100);

          const newPMData = {
            rowIndex,
            customerId,
            productId,
            packSize,
            packType,
            brandName: state.header?.name_on_label || state.product?.brand_name || '',
            isNewBatch,
            batchQuantity: currentData.batchQuantity || (isNewBatch ? minQty : 0),
            ratePerPM: initialRate,
            gstRate: initialGstRate,
            usedPcs: totalPcs,
            includeInQuotation: currentData.includeInQuotation !== undefined ? currentData.includeInQuotation : !isNewBatch,
            currentStock: inv.currentStock,
            closingStockAfter: isNewBatch ? (inv.currentStock + minQty - totalPcs) : (inv.currentStock - totalPcs),
            amount,
            gst,
            totalPMCost: amount + gst,
          };
          
          updatePMDataForRow(rowIndex, newPMData);
        }
      } catch (err) {
        console.error("PM inventory fetch error:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    
    fetchInventory();
    return () => { isMounted = false; };
  }, [customerId, productId, packSize, packType, totalPcs]);

  const handleInputChange = (field, value) => {
    let val = value;
    if (field === 'batchQuantity') {
      val = parseInt(value) || 0;
      if (val < 1000) {
        setErrorMsg('Minimum 1000 pms required');
      } else {
        setErrorMsg('');
      }
    }
    
    const qty = field === 'batchQuantity' ? val : (parseInt(pmData.batchQuantity) || 0);
    const rate = field === 'ratePerPM' ? (parseFloat(value) || 0) : (parseFloat(pmData.ratePerPM) || 0);
    const gstRate = field === 'gstRate' ? (parseFloat(value) || 0) : (parseFloat(pmData.gstRate) || 0);
    
    // For non-printed pouch/bucket, use totalPcs. For printed/labels, use batchQuantity.
    const isPouchOrBucket = ['Bucket', 'Pouch'].includes(packType);
    const isNonPrinted = isPouchOrBucket && (field === 'withoutPM' ? value : pmData.withoutPM);
    const effectiveQty = isNonPrinted ? totalPcs : qty;

    const amount = effectiveQty * rate;
    const gst = amount * (gstRate / 100);
    
    updatePMDataForRow(rowIndex, {
      ...pmData,
      [field]: value,
      amount,
      gst,
      totalPMCost: amount + gst,
      closingStockAfter: pmData.isNewBatch ? ((data ? (data.currentStock || 0) : 0) + qty - totalPcs) : (data ? (data.currentStock || 0) - totalPcs : 0),
    });
  };

  const isPouchOrBucket = ['Bucket', 'Pouch'].includes(packType);
  const pmTypeLabel = isPouchOrBucket ? packType : 'Label';
  const toggleTitle = isPouchOrBucket ? `Without Printing` : `Order Without ${pmTypeLabel}`;
  const toggleDesc = isPouchOrBucket ? 'Check this if you are using plain, non-printed containers.' : 'Check this if the customer does not require a label.';
  
  if (packType === 'Drum') return null;
  if (!totalPcs) return null; // Only show after quantity is entered

  if (!customerId) {
    return (
      <div className="mt-6 p-4 bg-surface-alt border border-border rounded-xl">
        <div className="flex items-center gap-2 text-text-muted mb-2">
          <PackageSearch size={18} />
          <h3 className="font-bold">Packing Material Management</h3>
        </div>
        <p className="text-sm">Link customer to directory in Step 2 to enable packing material tracking.</p>
      </div>
    );
  }

  if (loading || !data) {
    return (
      <div className="mt-6 p-5 border border-border rounded-xl animate-pulse flex items-center gap-3 text-text-secondary">
        <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        Checking packing material inventory...
      </div>
    );
  }

  const { isFirstOrder, sufficient, currentStock, shortfall, history } = data;

  return (
    <div className="mt-6 animate-fade-in">
      <div className="flex items-center gap-2 text-primary-dark mb-3">
        <PackageSearch size={20} />
        <h3 className="font-bold text-lg">Packing Material Management</h3>
      </div>

      <div className="mb-4 bg-white p-3 border border-border rounded-lg flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm">{toggleTitle}</h4>
          <p className="text-xs text-text-muted">{toggleDesc}</p>
        </div>
        <input 
          type="checkbox" 
          checked={pmData.withoutPM || false}
          onChange={(e) => {
            updatePMDataForRow(rowIndex, { ...pmData, withoutPM: e.target.checked, includeInQuotation: !e.target.checked });
            if (!e.target.checked && data) {
               setErrorMsg(pmData.batchQuantity < 1000 ? 'Minimum 1000 units required' : '');
            } else {
               setErrorMsg('');
            }
          }}
          className="w-5 h-5 accent-primary cursor-pointer"
        />
      </div>

      {pmData.withoutPM ? (
        isPouchOrBucket ? (
          <div className="p-4 bg-surface-alt border border-border rounded-xl">
            <h5 className="font-semibold text-sm mb-3">Non-Printed {packType} Cost</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">Rate per {packType} (₹) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={pmData.ratePerPM || ''}
                  onChange={(e) => handleInputChange('ratePerPM', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">GST Rate (%) *</label>
                <input
                  type="number"
                  min="0"
                  value={pmData.gstRate !== undefined ? pmData.gstRate : 18}
                  onChange={(e) => handleInputChange('gstRate', e.target.value)}
                  className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>
            
            <div className="mt-4 p-3 bg-white rounded border border-border text-sm flex flex-col gap-1">
              <div className="flex justify-between text-text-secondary">
                <span>Amount ({totalPcs || 0} × ₹{pmData.ratePerPM || 0})</span>
                <span>₹{(totalPcs * (pmData.ratePerPM || 0)).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-text-primary mt-1 pt-1 border-t border-border">
                <span>Total PM Cost</span>
                <span>₹{(totalPcs * (pmData.ratePerPM || 0) * (1 + (pmData.gstRate || 0)/100)).toFixed(2)}</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="p-4 bg-surface-alt border border-border rounded-xl text-text-secondary text-sm">
            Packing Material inventory checks and costs are bypassed. This product will be shipped without {isPouchOrBucket ? 'printing' : 'a label'}.
          </div>
        )
      ) : (
        <>
          {/* STATE A: SUFFICIENT LABELS */}
          {sufficient && !isFirstOrder && (
            <div className="p-5 border-2 border-success/40 bg-success-light/20 rounded-xl">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={24} className="text-success flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-bold text-success-dark text-lg">Packing Material Stock Available</h4>
              <div className="mt-2 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-text-muted">Current Stock</p>
                  <p className="font-bold text-text-primary">{(currentStock || 0).toLocaleString()} units</p>
                </div>
                <div>
                  <p className="text-text-muted">This order needs</p>
                  <p className="font-bold text-text-primary">{(totalPcs || 0).toLocaleString()} units</p>
                </div>
                <div>
                  <p className="text-text-muted">Remaining after dispatch</p>
                  <p className="font-bold text-success">{(pmData.closingStockAfter || 0).toLocaleString()} units</p>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-success/20 flex items-center gap-3">
                <input
                  type="checkbox"
                  id={`includePM_${rowIndex}`}
                  checked={pmData.includeInQuotation ?? true}
                  onChange={(e) => updatePMDataForRow(rowIndex, { ...pmData, includeInQuotation: e.target.checked })}
                  className="w-4 h-4 accent-success cursor-pointer"
                />
                <label htmlFor={`includePM_${rowIndex}`} className="text-sm font-medium cursor-pointer text-success-dark select-none">
                  Show Packing Material Details in Quotation
                </label>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* STATE B & C: NEW PRODUCT OR INSUFFICIENT LABELS */}
      {(!sufficient || isFirstOrder) && (
        <div className={`p-5 border-2 rounded-xl ${isFirstOrder ? 'border-warning/40 bg-warning-light/20' : 'border-error/40 bg-error-light/20'}`}>
          <div className="flex items-start gap-3">
            {isFirstOrder ? (
              <Info size={24} className="text-warning flex-shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle size={24} className="text-error flex-shrink-0 mt-0.5" />
            )}
            
            <div className="flex-1">
              <h4 className={`font-bold text-lg ${isFirstOrder ? 'text-warning-dark' : 'text-error-dark'}`}>
                {isFirstOrder ? 'New Packing Material Inventory — First Order' : 'Insufficient Packing Materials'}
              </h4>
              
              {isFirstOrder ? (
                <p className="text-sm mt-1 text-warning-dark">No packing materials found for this product. Minimum order: 1000 units (MOQ).</p>
              ) : (
                <div className="mt-2 grid grid-cols-3 gap-4 text-sm text-error-dark">
                  <div>
                    <p className="opacity-80">Current Stock</p>
                    <p className="font-bold">{(currentStock || 0).toLocaleString()} units</p>
                  </div>
                  <div>
                    <p className="opacity-80">This order needs</p>
                    <p className="font-bold">{(totalPcs || 0).toLocaleString()} units</p>
                  </div>
                  <div>
                    <p className="opacity-80">Shortfall</p>
                    <p className="font-bold">{(shortfall || 0).toLocaleString()} units</p>
                  </div>
                </div>
              )}
              
              {(!isFirstOrder) && (
                <p className="text-sm mt-3 font-medium text-error">You must add a new packing material batch to continue.</p>
              )}

              {/* PM Batch Form */}
              <div className="mt-5 p-4 bg-white rounded-lg border border-border">
                <h5 className="font-semibold text-sm mb-3">Order New Packing Material Batch</h5>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Packing Material Quantity *</label>
                    <input
                      type="number"
                      min="1000"
                      value={pmData.batchQuantity || ''}
                      onChange={(e) => handleInputChange('batchQuantity', e.target.value)}
                      className={`w-full px-3 py-2 border rounded-md text-sm focus:outline-none focus:ring-1 ${errorMsg ? 'border-error focus:ring-error' : 'border-border focus:ring-primary'}`}
                    />
                    {errorMsg && <p className="text-xs text-error mt-1">{errorMsg}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">Rate per Unit (₹) *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={pmData.ratePerPM || ''}
                      onChange={(e) => handleInputChange('ratePerPM', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-text-secondary mb-1">GST Rate (%) *</label>
                    <input
                      type="number"
                      min="0"
                      value={pmData.gstRate !== undefined ? pmData.gstRate : 18}
                      onChange={(e) => handleInputChange('gstRate', e.target.value)}
                      className="w-full px-3 py-2 border border-border rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>
                
                {/* Live Preview */}
                <div className="mt-4 p-3 bg-surface-alt rounded border border-border text-sm flex flex-col gap-1">
                  <div className="flex justify-between text-text-secondary">
                    <span>Amount ({pmData.batchQuantity || 0} × ₹{pmData.ratePerPM || 0})</span>
                    <span>₹{(pmData.amount || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-text-secondary">
                    <span>GST ({pmData.gstRate !== undefined ? pmData.gstRate : 18}%)</span>
                    <span>₹{(pmData.gst || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-text-primary mt-1 pt-1 border-t border-border">
                    <span>Total Packing Material Cost</span>
                    <span>₹{(pmData.totalPMCost || 0).toFixed(2)}</span>
                  </div>
                </div>
                <p className="text-xs text-text-muted mt-2 text-center">This cost will be added to quotation total.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVENTORY REFERENCE CARD (ALL STATES) */}
      <div className="mt-3 border border-border rounded-lg overflow-hidden bg-white">
        <button 
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 flex items-center justify-between bg-surface-alt hover:bg-surface transition-colors"
        >
          <span className="text-xs font-semibold text-text-secondary uppercase tracking-wider">Inventory Reference</span>
          {expanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
        </button>
        {expanded && (
          <div className="p-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="text-xs text-text-muted border-b border-border">
                  <th className="pb-2 font-medium">Customer</th>
                  <th className="pb-2 font-medium">Company</th>
                  <th className="pb-2 font-medium">Code</th>
                  <th className="pb-2 font-medium">Product</th>
                  <th className="pb-2 font-medium">Pack Size</th>
                  <th className="pb-2 font-medium text-right">Total Printed</th>
                  <th className="pb-2 font-medium text-right">Used to Date</th>
                  <th className="pb-2 font-medium text-right">Closing Stock</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-border/50 last:border-0">
                  <td className="py-2 text-text-primary">{state.header?.customer_name || '-'}</td>
                  <td className="py-2 text-text-secondary">{state.header?.billing_name || '-'}</td>
                  <td className="py-2 text-text-secondary">{state.product?.product_code || '-'}</td>
                  <td className="py-2 text-text-primary font-medium">{state.product?.product_name || '-'}</td>
                  <td className="py-2 text-text-secondary">{packSize}</td>
                  <td className="py-2 text-right font-medium">{history?.total_printed?.toLocaleString() || 0}</td>
                  <td className="py-2 text-right font-medium text-warning-dark">{history?.used_to_date?.toLocaleString() || 0}</td>
                  <td className="py-2 text-right font-bold text-primary">{currentStock.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  )}
</div>
);
}

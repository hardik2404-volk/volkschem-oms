import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuotation } from '../../context/QuotationContext';
import { costSheetService } from '../../services/dataService';
import ComponentCheckboxRow from '../components/ComponentCheckboxRow';
import { Plus, Trash2, AlertTriangle, CheckCircle2, PackageSearch } from 'lucide-react';
import api from '../../services/api';

import { AMPOULE_PACKAGING } from '../../utils/constants';

const COMPONENT_MAP = {
  Bottle:      ['Bulk Material', 'Bottle', 'Measuring Cap', 'Shrink Cap', 'Carton Box', 'Job Work'],
  Ampoule:     ['Bulk Material', 'Ampoule Glass', 'Tray', 'FBB Box', 'Inner Box', 'Outer Box', 'Job Work'],
  Pouch:       ['Bulk Material', 'Carton Box', 'Job Work'],
  'Jar/Dabba': ['Bulk Material', 'Jar/Dabba', 'Carton Box', 'Job Work'],
  Bucket:      ['Bulk Material', 'Job Work'],
  Drum:        ['Bulk Material', 'Drum', 'Job Work'],
};

const SMALL_BOTTLE_SIZES = ['1ml', '2ml', '5ml', '10ml', '25ml'];

const NO_DIVISION = new Set([
  'Bulk Material', 'Ampoule Glass', 'Shrink Cap',
  'Bottle', 'Pouch', 'Jar/Dabba', 'Bucket', 'Drum', 'Job Work',
]);

function calcBulkCost(packSizeValue, packSizeUnit, bulkRate) {
  if (!packSizeValue || !bulkRate) return 0;
  let v = packSizeValue;
  const u = packSizeUnit?.toLowerCase();
  if (u === 'ml') v /= 1000;
  else if (u === 'gm') v /= 1000;
  return parseFloat((v * bulkRate).toFixed(4));
}

function getDivisor(componentName, packingType, packSize, nosPerCarton) {
  if (NO_DIVISION.has(componentName)) return { divisor: 1, label: '' };
  if (componentName === 'Carton Box') {
    const d = parseInt(nosPerCarton) || 1;
    return { divisor: d, label: `${d} nos per carton` };
  }
  if (packingType === 'Ampoule') {
    const spec = AMPOULE_PACKAGING[packSize];
    if (!spec) return { divisor: 1, label: '' };
    switch (componentName) {
      case 'Tray':      return { divisor: spec.trayPcs,     label: `${spec.trayPcs} pcs per tray` };
      case 'FBB Box':   return { divisor: spec.fbbBoxPcs,   label: `${spec.fbbBoxPcs} pcs per FBB Box` };
      case 'Inner Box': return { divisor: spec.innerBoxPcs, label: `${spec.innerBoxPcs} pcs per inner box` };
      case 'Outer Box': return { divisor: spec.outerBoxPcs, label: `${spec.outerBoxPcs} pcs per outer box` };
      default: return { divisor: 1, label: '' };
    }
  }
  return { divisor: 1, label: '' };
}


export default function Step4CostBuilder() {
  const { state, updateField } = useQuotation();
  const [components, setComponents] = useState([]);
  const [customLines, setCustomLines] = useState(state.customLines || []);
  const [fetchedRates, setFetchedRates] = useState({});

  const packingType = state.packingType;
  const packSize = state.packSize;
  const product = state.product;
  const bulkRate = state.productBulkRate || product?.bulk_rate_per_ltr_kg || 0;
  const bulkCost = calcBulkCost(state.packSizeValue, state.packSizeUnit, bulkRate);
  const nosPerCarton = parseInt(state.rows?.[0]?.nosPerCarton) || 1;
  const totalPcs = state.rows?.[0]?.totalPcs || 0;
  const customerId = state.customer_id;

  let allowedComponents = COMPONENT_MAP[packingType] || [];
  if (packingType === 'Bottle' && SMALL_BOTTLE_SIZES.includes(packSize)) {
    allowedComponents = allowedComponents.filter((c) => c !== 'Shrink Cap' && c !== 'Measuring Cap');
  }

  useEffect(() => {
    const fetchRates = async () => {
      const rates = {};
      const categories = [
        'bottles', 'ampoules', 'bottle_labels', 'ampoule_labels', 'labels',
        'pouches', 'cartons', 'fbb_boxes', 'trays', 'inner_boxes', 'outer_boxes',
        'shrink_caps', 'buckets', 'drums', 'jars',
      ];
      try {
        const results = await Promise.allSettled(categories.map((cat) => costSheetService.getRatesByCategory(cat)));
        results.forEach((r, i) => {
          if (r.status === 'fulfilled') rates[`_cat_${categories[i]}`] = r.value.data?.data || [];
        });
      } catch {}
      setFetchedRates(rates);
    };
    fetchRates();
  }, []);

  useEffect(() => {
    const norm = (s) => (s || '').toString().toLowerCase().replace(/\s+/g, '');
    const isSizeMatch = (dbSize, reqSize) => {
      const normDb = norm(dbSize);
      const normReq = norm(reqSize);
      if (normDb === normReq) return true;
      if (normDb.replace(/nos/g, '') === normReq) return true; // handle '15mlnos'

      const reqMatch = reqSize.toLowerCase().match(/([\d.]+)\s*([a-z]+)/);
      if (!reqMatch) return normDb.includes(normReq);

      const reqNum = reqMatch[1];
      const reqU = reqMatch[2];
      const regex = new RegExp(`(^|[^\\d.])${reqNum}\\s*(/\\s*\\d+\\s*)?${reqU}`, 'i'); // handles 10/15 ML and 10 ML
      
      // Also check if dbSize has shared unit at the end, e.g. "10/15 ML" -> we should match "15 ML"
      const regexSharedUnit = new RegExp(`(^|[^\\d.])${reqNum}\\s*([/\\-a-z\\s]*)\\s*${reqU}`, 'i');
      return regexSharedUnit.test(dbSize);
    };

    const findRate = (catKey, variant, size) => {
      const items = fetchedRates[`_cat_${catKey}`] || [];
      const exact = items.find((i) => 
        (!variant || i.item_name?.toLowerCase().includes(variant.toLowerCase()) || i.component_name?.toLowerCase().includes(variant.toLowerCase())) && 
        (isSizeMatch(i.size, size) || isSizeMatch(i.pack_size, size))
      );
      if (exact) return exact.rate || 0;
      
      const sizeOnly = items.find((i) => isSizeMatch(i.size, size) || isSizeMatch(i.pack_size, size));
      if (sizeOnly) return sizeOnly.rate || 0;
      return 0;
    };

    setComponents((prevComps) => {
      const existingState = prevComps.reduce((acc, c) => ({ ...acc, [c.name]: c }), {});
      
      return allowedComponents.map((name) => {
        let defaultRate = 0;
        let variantLabel = '';
        let isBulk = false;

        switch (name) {
          case 'Bulk Material':
            isBulk = true;
            defaultRate = bulkCost;
            variantLabel = `${state.packSizeValue}${state.packSizeUnit} @ ₹${bulkRate}/${product?.rate_unit === 'kg' ? 'Kg' : 'Ltr'}`;
            break;
          case 'Bottle': variantLabel = state.packingVariant || ''; defaultRate = findRate('bottles', state.packingVariant, packSize); break;
          case 'Ampoule Glass': variantLabel = packSize; defaultRate = findRate('ampoules', 'Glass', packSize); break;
          case 'Measuring Cap': defaultRate = findRate('measuring_caps', 'Measuring', packSize); break;
          case 'Shrink Cap': defaultRate = findRate('shrink_caps', 'Shrink', packSize); break;
          case 'Carton Box': defaultRate = findRate('cartons', 'Carton', packSize); break;
          case 'Tray': defaultRate = findRate('trays', 'Tray', packSize); break;
          case 'FBB Box': defaultRate = findRate('fbb_boxes', 'FBB', packSize); break;
          case 'Inner Box': defaultRate = findRate('inner_boxes', 'Inner', packSize); break;
          case 'Outer Box': defaultRate = findRate('outer_boxes', 'Outer', packSize); break;
          case 'Pouch': variantLabel = state.packingVariant || ''; defaultRate = findRate('pouches', state.packingVariant, packSize); break;
          case 'Jar/Dabba': variantLabel = state.packingVariant || ''; defaultRate = findRate('jars', state.packingVariant, packSize); break;
          case 'Bucket': defaultRate = findRate('buckets', 'Bucket', packSize); break;
          case 'Drum': defaultRate = findRate('drums', 'Drum', packSize); break;
          case 'Job Work': default: defaultRate = 0;
        }

        const existing = existingState[name];

        let applied = isBulk ? bulkCost : defaultRate;
        if (existing) {
          // If user didn't modify appliedRate (it matches old defaultRate or was 0), let it update to new defaultRate
          if (existing.appliedRate !== existing.defaultRate && existing.appliedRate !== 0 && existing.appliedRate !== '') {
            applied = existing.appliedRate;
          }
        }

        return {
          name,
          variantLabel,
          isChecked: existing ? existing.isChecked : true,
          canUncheck: true,
          isBulk,
          defaultRate,
          appliedRate: applied,
        };
      });
    });
  }, [allowedComponents.join(','), bulkCost, fetchedRates, packSize, bulkRate]);

  const updateComponent = (index, field, value) => {
    setComponents((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  };

  const addCustomLine = () => setCustomLines((prev) => [...prev, { name: '', rate: 0 }]);
  const updateCustomLine = (index, field, value) => setCustomLines((prev) => { const n = [...prev]; n[index] = { ...n[index], [field]: value }; return n; });
  const removeCustomLine = (index) => setCustomLines((prev) => prev.filter((_, i) => i !== index));

  const costPerPcs = useMemo(() => {
    let total = 0;
    components.forEach((c) => {
      if (!c.isChecked) return;
      if (c.isBulk) {
        total += bulkCost;
      } else {
        const { divisor } = getDivisor(c.name, packingType, packSize, nosPerCarton);
        total += (Number(c.appliedRate) || 0) / divisor;
      }
    });
    customLines.forEach((cl) => { total += cl.rate || 0; });
    return Math.round(total * 10000) / 10000;
  }, [components, customLines, bulkCost, packingType, packSize, nosPerCarton]);

  useEffect(() => {
    const mapped = components.map((c) => {
      const { divisor } = getDivisor(c.name, packingType, packSize, nosPerCarton);
      const cpp = c.isChecked ? (c.isBulk ? bulkCost : (Number(c.appliedRate) || 0) / divisor) : 0;
      return {
        component_name: c.name,
        is_checked: c.isChecked,
        default_rate: c.defaultRate,
        applied_rate: c.appliedRate,
        cost_per_pcs: Math.round(cpp * 10000) / 10000,
        divisor,
      };
    });
    updateField('components', mapped);
    updateField('customLines', customLines);

    const gstRate = state.rows[0]?.gstRate !== undefined ? state.rows[0].gstRate : (state.product?.gst_rate || 18);
    updateField('rows', state.rows.map((r, i) =>
      i === 0
        ? {
            ...r,
            costPerPcs,
            rowAmount: Math.round(costPerPcs * r.totalPcs * 100) / 100,
            gstAmount: Math.round(costPerPcs * r.totalPcs * (gstRate / 100) * 100) / 100,
            rowTotal: Math.round(costPerPcs * r.totalPcs * (1 + gstRate / 100) * 100) / 100,
          }
        : r
    ));
  }, [components, customLines, bulkCost, costPerPcs, state.rows[0]?.gstRate]);

  const getBreakdownText = (comp) => {
    if (comp.isBulk) return `${state.packSizeValue}${state.packSizeUnit} × ₹${bulkRate}/${product?.rate_unit === 'kg' ? 'Kg' : 'Ltr'} = ₹${bulkCost.toFixed(2)}`;
    const { divisor, label } = getDivisor(comp.name, packingType, packSize, nosPerCarton);
    if (divisor > 1 && label) return `₹${(Number(comp.appliedRate) || 0).toFixed(2)} ÷ ${label} = ₹${((Number(comp.appliedRate) || 0) / divisor).toFixed(4)}`;
    return '';
  };

  const getCostPerPcsForComp = (comp) => {
    if (!comp.isChecked) return 0;
    if (comp.isBulk) return bulkCost;
    const { divisor } = getDivisor(comp.name, packingType, packSize, nosPerCarton);
    return Math.round(((Number(comp.appliedRate) || 0) / divisor) * 10000) / 10000;
  };

  return (
    <div className="animate-fade-in max-w-7xl mx-auto">
      <div className="flex items-center gap-2 text-primary-dark mb-4">
        <h2 className="text-xl font-bold">Cost Builder</h2>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1">
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="bg-primary text-white">
                  <th className="px-3 py-2.5 text-xs font-semibold w-16">Include</th>
                  <th className="px-3 py-2.5 text-xs font-semibold text-left">Component</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Default Rate (₹)</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Applied Rate (₹)</th>
                  <th className="px-3 py-2.5 text-xs font-semibold">Cost / Pcs (₹)</th>
                </tr>
              </thead>
              <tbody>
                {components.map((comp, i) => {
                  return (
                    <ComponentCheckboxRow
                      key={comp.name}
                      componentName={comp.name}
                      variantLabel={comp.variantLabel}
                      isChecked={comp.isChecked}
                      canUncheck={comp.canUncheck}
                      defaultRate={comp.isBulk ? bulkCost : comp.defaultRate}
                      appliedRate={comp.isBulk ? bulkCost : comp.appliedRate}
                      costPerPcs={getCostPerPcsForComp(comp)}
                      isReadOnlyRate={comp.isBulk}
                      divisionBreakdown={comp.isChecked ? getBreakdownText(comp) : ''}
                      onCheckChange={(val) => updateComponent(i, 'isChecked', val)}
                      onRateChange={(val) => updateComponent(i, 'appliedRate', val)}
                    />
                  );
                })}

                {customLines.map((cl, i) => (
                  <tr key={`custom-${i}`} className="border-b border-border bg-action-light/20">
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => removeCustomLine(i)} className="text-error hover:bg-error-light p-1 rounded">
                        <Trash2 size={14} />
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <input type="text" value={cl.name}
                        onChange={(e) => updateCustomLine(i, 'name', e.target.value)}
                        placeholder="Custom item name"
                        className="w-full px-2 py-1 border border-border rounded text-sm focus:outline-none focus:ring-1 focus:ring-primary-lighter"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-text-muted">—</td>
                    <td className="px-3 py-2.5 text-center">
                      <input type="number" step="0.01" min="0" value={cl.rate}
                        onChange={(e) => updateCustomLine(i, 'rate', parseFloat(e.target.value) || 0)}
                        className="w-24 px-2 py-1.5 border border-border rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-lighter"
                      />
                    </td>
                    <td className="px-3 py-2.5 text-center text-sm font-semibold">₹{(cl.rate || 0).toFixed(2)}</td>
                  </tr>
                ))}

                <tr className="border-t-2 border-primary/20 bg-primary/5">
                  <td colSpan={4} className="px-3 py-3 font-bold text-primary text-sm">Cost Per Piece (Without GST)</td>
                  <td className="px-3 py-3 text-center font-bold text-xl text-primary">₹{costPerPcs.toFixed(2)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <button onClick={addCustomLine} className="mt-3 inline-flex items-center gap-1.5 text-primary text-sm font-medium hover:underline">
            <Plus size={16} /> Add Custom Line
          </button>
        </div>

        <div className="w-full lg:w-64 flex-shrink-0">
          <div className="bg-white border border-border rounded-xl p-5 sticky top-20">
            <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider mb-4">RUNNING TOTAL</h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs text-text-muted">Cost Per Piece (₹)</p>
                <p className="text-3xl font-bold text-text-primary">{costPerPcs.toFixed(2)}</p>
              </div>
              <hr className="border-border" />
              {totalPcs > 0 && (
                <>
                  <div>
                    <p className="text-xs text-text-muted">× {totalPcs.toLocaleString('en-IN')} pcs</p>
                    <p className="text-lg font-bold text-text-primary">
                      ₹{(costPerPcs * totalPcs).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <hr className="border-border" />
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-xs text-text-muted">GST Rate (%)</p>
                      <input 
                        type="number" 
                        min="0"
                        step="0.1"
                        className="w-16 px-1 py-0.5 text-xs border rounded text-right focus:outline-none focus:ring-1 focus:ring-primary"
                        value={state.rows[0]?.gstRate !== undefined ? state.rows[0].gstRate : (state.product?.gst_rate || 18)}
                        onChange={(e) => {
                          const val = e.target.value === '' ? '' : parseFloat(e.target.value);
                          updateField('rows', state.rows.map((r, i) => i === 0 ? { ...r, gstRate: val } : r));
                        }}
                      />
                    </div>
                    <p className="font-semibold text-text-secondary">
                      ₹{(costPerPcs * totalPcs * ((state.rows[0]?.gstRate !== undefined ? state.rows[0].gstRate : (state.product?.gst_rate || 18)) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  <hr className="border-border" />
                  <div>
                    <p className="text-xs text-text-muted">Grand Total</p>
                    <p className="text-xl font-bold text-primary">
                      ₹{(costPerPcs * totalPcs * (1 + (state.rows[0]?.gstRate !== undefined ? state.rows[0].gstRate : (state.product?.gst_rate || 18)) / 100)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </>
              )}
              <p className="text-xs text-text-muted">Cost per piece after division adjustments</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

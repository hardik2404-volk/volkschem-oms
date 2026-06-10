export default function ComponentCheckboxRow({
  componentName,
  variantLabel,
  isChecked,
  canUncheck = true,
  defaultRate,
  appliedRate,
  costPerPcs,
  isReadOnlyRate = false,
  divisionBreakdown = '',
  onCheckChange,
  onRateChange,
  extraInput = null,
}) {
  return (
    <tr className={`border-b border-border last:border-b-0 ${!isChecked ? 'opacity-50' : ''} transition-opacity`}>
      <td className="px-3 py-2.5 text-center">
        <input
          type="checkbox"
          checked={isChecked}
          disabled={!canUncheck}
          onChange={(e) => onCheckChange(e.target.checked)}
          className="w-4 h-4 accent-primary rounded cursor-pointer disabled:cursor-not-allowed"
        />
      </td>
      <td className="px-3 py-2.5">
        <p className="text-sm font-medium text-text-primary">{componentName}</p>
        {variantLabel && <p className="text-xs text-text-muted">{variantLabel}</p>}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="text-xs text-text-muted">₹{defaultRate?.toFixed(2)}</span>
      </td>
      <td className="px-3 py-2.5 text-center">
        {isReadOnlyRate ? (
          <span className="text-sm font-medium text-text-primary">₹{Number(appliedRate || 0).toFixed(2)}</span>
        ) : (
          <div className="flex flex-col gap-1 items-center justify-center">
            <input
              type="text"
              value={appliedRate}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '' || /^\d*\.?\d*$/.test(val)) {
                  onRateChange(val);
                }
              }}
              disabled={!isChecked}
              className="w-24 px-2 py-1.5 border border-border rounded-md text-sm text-center focus:outline-none focus:ring-1 focus:ring-primary-lighter disabled:bg-surface-alt"
            />
            {isChecked && extraInput}
          </div>
        )}
      </td>
      <td className="px-3 py-2.5 text-center">
        <span className="text-sm font-semibold text-text-primary">₹{isChecked ? costPerPcs?.toFixed(4) : '0.0000'}</span>
        {/* FIX 4: Division breakdown text in grey */}
        {divisionBreakdown && isChecked && (
          <p className="text-[10px] text-text-muted mt-0.5 leading-tight">{divisionBreakdown}</p>
        )}
      </td>
    </tr>
  );
}

/**
 * Format a cedi amount for display. Whole amounts stay clean ("GH₵ 120");
 * amounts with pesewas always show two decimals ("GH₵ 126.50") so fees
 * never look rounded away.
 */
export function ghs(amount) {
  const n = Number(amount) || 0;
  const hasPesewas = Math.round(n * 100) % 100 !== 0;
  return `GH₵ ${n.toLocaleString('en-GH', {
    minimumFractionDigits: hasPesewas ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

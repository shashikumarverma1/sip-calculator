export function formatINR(value: number): string {
  const rounded = Math.round(value);
  const isNegative = rounded < 0;
  const abs = Math.abs(rounded);
  const digits = abs.toString();
  const last3 = digits.length > 3 ? digits.slice(-3) : digits;
  const rest = digits.length > 3 ? digits.slice(0, -3) : '';
  const groupedRest = rest.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  const formatted = groupedRest ? `${groupedRest},${last3}` : last3;
  return `${isNegative ? '-' : ''}₹${formatted}`;
}

export function formatCompactINR(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_00_00_000) return `${sign}₹${(abs / 1_00_00_000).toFixed(2)}Cr`;
  if (abs >= 1_00_000) return `${sign}₹${(abs / 1_00_000).toFixed(2)}L`;
  if (abs >= 1_000) return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  return formatINR(value);
}

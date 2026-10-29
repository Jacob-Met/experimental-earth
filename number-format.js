// Reuse locale machinery while preserving the workbench's existing numeric
// conversions and rounding order. These objects never leave this module.
const modelFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });
const readingFormatter = new Intl.NumberFormat('en-US', { maximumSignificantDigits: 6 });
const pondingFormatter = new Intl.NumberFormat('en-US');

export function modelNumber(value) {
  return modelFormatter.format(Number(value));
}

export function readingNumber(value) {
  return readingFormatter.format(Number(value));
}

export function pondingNumber(x) {
  // Keep toFixed before Number: Intl rounding at two fractional digits alone
  // would change existing labels at values such as 1.005.
  return pondingFormatter.format(Number(x.toFixed(2)));
}

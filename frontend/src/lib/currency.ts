/** Amounts everywhere in this app are integers in minor units, e.g. cents (specs/backend-spec.md Data Model). */
export function formatCurrency(amountInMinorUnits: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountInMinorUnits / 100);
}

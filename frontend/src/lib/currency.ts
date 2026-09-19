/** Amounts everywhere in this app are integers in paise (specs/backend-spec.md Data Model). */
export function formatCurrency(amountInPaise: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    maximumFractionDigits: 2,
  }).format(amountInPaise / 100);
}

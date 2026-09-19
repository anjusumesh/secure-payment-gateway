import { formatCurrency } from '../lib/currency.ts';

interface OrderSummaryProps {
  total: number;
  disabled: boolean;
  onCheckout: () => void;
}

export function OrderSummary({ total, disabled, onCheckout }: OrderSummaryProps) {
  return (
    <aside
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 20,
        background: 'var(--color-bg)',
        alignSelf: 'flex-start',
        width: '100%',
        maxWidth: 320,
      }}
    >
      <h2 style={{ fontSize: 20 }}>Total</h2>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          padding: '12px 0',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontWeight: 600 }}>Sub-Total</span>
        <span style={{ fontWeight: 600 }}>{formatCurrency(total)}</span>
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ width: '100%', marginTop: 20 }}
        disabled={disabled}
        onClick={onCheckout}
      >
        Check Out
      </button>

      <div style={{ marginTop: 20 }}>
        <div style={{ fontWeight: 600, marginBottom: 8 }}>We Accept</div>
        <div style={{ fontSize: 14, color: 'var(--color-text-muted)' }}>
          Card · UPI · Net Banking (via Razorpay)
        </div>
      </div>
    </aside>
  );
}

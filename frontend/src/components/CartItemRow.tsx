import { formatCurrency } from '../lib/currency.ts';
import { getSportEmoji } from '../lib/sportEmoji.ts';
import type { CartLine } from '../types/index.ts';
import { QuantityStepper } from './QuantityStepper.tsx';

interface CartItemRowProps {
  line: CartLine;
  onQuantityChange: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
}

export function CartItemRow({ line, onQuantityChange, onRemove }: CartItemRowProps) {
  const { item, quantity } = line;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 16,
        border: '1px solid var(--color-border)',
        borderRadius: 10,
        padding: 16,
        background: 'var(--color-bg)',
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          flexShrink: 0,
          borderRadius: 8,
          background: 'var(--color-bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
        }}
        aria-hidden="true"
      >
        {getSportEmoji(item.name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{item.name}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{item.code}</div>
      </div>

      <QuantityStepper
        quantity={quantity}
        onChange={(next) => onQuantityChange(item.id, next)}
      />

      <div style={{ width: 90, textAlign: 'right', color: 'var(--color-text-muted)' }}>
        {formatCurrency(item.price)}
      </div>

      <div style={{ width: 100, textAlign: 'right', fontWeight: 600 }}>
        {formatCurrency(item.price * quantity)}
      </div>

      <button
        type="button"
        aria-label={`Remove ${item.name} from cart`}
        onClick={() => onRemove(item.id)}
        style={{
          border: 'none',
          background: 'none',
          color: 'var(--color-text-muted)',
          fontSize: 18,
          cursor: 'pointer',
          lineHeight: 1,
        }}
      >
        ×
      </button>
    </div>
  );
}

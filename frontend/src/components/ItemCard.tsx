import { formatCurrency } from '../lib/currency.ts';
import { getSportEmoji } from '../lib/sportEmoji.ts';
import type { Item } from '../types/index.ts';

interface ItemCardProps {
  item: Item;
  onAddToCart: (item: Item) => void;
}

export function ItemCard({ item, onAddToCart }: ItemCardProps) {
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
          width: 64,
          height: 64,
          flexShrink: 0,
          borderRadius: 8,
          background: 'var(--color-bg-secondary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 32,
        }}
        aria-hidden="true"
      >
        {getSportEmoji(item.name)}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600 }}>{item.name}</div>
        <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>{item.code}</div>
      </div>

      <div style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(item.price)}</div>

      <button type="button" className="btn-primary" onClick={() => onAddToCart(item)}>
        Add to Cart
      </button>
    </div>
  );
}

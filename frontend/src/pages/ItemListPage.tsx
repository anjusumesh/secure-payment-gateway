import { useEffect, useState } from 'react';
import { ItemCard } from '../components/ItemCard.tsx';
import { useCart } from '../context/useCart.ts';
import { itemsService } from '../services/itemsService.ts';
import type { Item } from '../types/index.ts';

export function ItemListPage() {
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const { addItem } = useCart();

  useEffect(() => {
    let cancelled = false;

    itemsService
      .getAll()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setStatus('ready');
        }
      })
      .catch(() => {
        if (!cancelled) setStatus('error');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (status === 'loading') {
    return <p className="container">Loading items…</p>;
  }

  if (status === 'error') {
    return <p className="container">Couldn't load items. Please try again later.</p>;
  }

  return (
    <div className="container" style={{ paddingBlock: 24 }}>
      <h1>Sports Store</h1>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {items.map((item) => (
          <ItemCard key={item.id} item={item} onAddToCart={addItem} />
        ))}
      </div>
    </div>
  );
}

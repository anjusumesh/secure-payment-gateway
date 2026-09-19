import { useNavigate } from 'react-router-dom';
import { CartItemRow } from '../components/CartItemRow.tsx';
import { OrderSummary } from '../components/OrderSummary.tsx';
import { useCart } from '../context/useCart.ts';

export function CartPage() {
  const { lines, total, setQuantity, removeItem } = useCart();
  const navigate = useNavigate();

  if (lines.length === 0) {
    return (
      <div className="container" style={{ paddingBlock: 24 }}>
        <h1>Your Cart</h1>
        <p>Your cart is empty.</p>
      </div>
    );
  }

  return (
    <div className="container" style={{ paddingBlock: 24 }}>
      <h1>Your Cart</h1>
      <div
        style={{
          display: 'flex',
          gap: 24,
          alignItems: 'flex-start',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: '1 1 480px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {lines.map((line) => (
            <CartItemRow
              key={line.item.id}
              line={line}
              onQuantityChange={setQuantity}
              onRemove={removeItem}
            />
          ))}
        </div>

        <OrderSummary total={total} disabled={false} onCheckout={() => navigate('/payment')} />
      </div>
    </div>
  );
}

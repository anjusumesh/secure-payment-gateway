import { Link } from 'react-router-dom';
import { useCart } from '../context/useCart.ts';

export function Header() {
  const { itemCount } = useCart();

  return (
    <header
      style={{
        borderBottom: '1px solid var(--color-border)',
        background: 'var(--color-bg)',
      }}
    >
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBlock: 16,
        }}
      >
        <Link
          to="/"
          style={{
            fontWeight: 700,
            fontSize: 20,
            textDecoration: 'none',
            color: 'var(--color-primary)',
          }}
        >
          Sports Store
        </Link>
        <Link
          to="/cart"
          className="btn-secondary"
          style={{ textDecoration: 'none', display: 'inline-block' }}
        >
          Cart ({itemCount})
        </Link>
      </div>
    </header>
  );
}

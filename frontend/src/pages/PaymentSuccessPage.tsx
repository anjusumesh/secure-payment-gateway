import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatCurrency } from '../lib/currency.ts';
import { transactionsService } from '../services/transactionsService.ts';
import type { TransactionDetail } from '../types/index.ts';

interface LocationState {
  transactionId?: string;
}

export function PaymentSuccessPage() {
  const location = useLocation();
  const { transactionId } = (location.state as LocationState | null) ?? {};
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    transactionsService.getById(transactionId).then(setTransaction).catch(() => undefined);
  }, [transactionId]);

  return (
    <div className="container" style={{ paddingBlock: 24, maxWidth: 480, textAlign: 'center' }}>
      <div style={{ fontSize: 48, color: 'var(--color-status-done)' }} aria-hidden="true">
        ✓
      </div>
      <h1 style={{ color: 'var(--color-status-done)' }}>Payment Successful</h1>

      {transaction ? (
        <p>
          Reference <strong>{transaction.id}</strong> · Amount paid{' '}
          <strong>{formatCurrency(transaction.amount, transaction.currency)}</strong>
        </p>
      ) : (
        <p>Your payment was completed.</p>
      )}

      <Link to="/" className="btn-primary" style={{ textDecoration: 'none', display: 'inline-block', marginTop: 16 }}>
        Continue Shopping
      </Link>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { transactionsService } from '../services/transactionsService.ts';
import type { TransactionDetail } from '../types/index.ts';

interface LocationState {
  transactionId?: string;
}

const COPY: Record<string, { title: string; body: string }> = {
  FAILED: {
    title: 'Payment Failed',
    body: 'Your payment could not be completed. No amount has been charged.',
  },
  CANCELLED: {
    title: 'Payment Cancelled',
    body: 'You closed the checkout before completing payment. No amount has been charged.',
  },
};

export function PaymentErrorPage() {
  const location = useLocation();
  const { transactionId } = (location.state as LocationState | null) ?? {};
  const [transaction, setTransaction] = useState<TransactionDetail | null>(null);

  useEffect(() => {
    if (!transactionId) return;
    transactionsService.getById(transactionId).then(setTransaction).catch(() => undefined);
  }, [transactionId]);

  const copy = COPY[transaction?.status ?? 'FAILED'] ?? COPY.FAILED;

  return (
    <div className="container" style={{ paddingBlock: 24, maxWidth: 480, textAlign: 'center' }}>
      <div style={{ fontSize: 48, color: 'var(--color-status-failed)' }} aria-hidden="true">
        ×
      </div>
      <h1 style={{ color: 'var(--color-status-failed)' }}>{copy.title}</h1>
      <p>{copy.body}</p>

      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 16 }}>
        <Link to="/cart" className="btn-primary" style={{ textDecoration: 'none' }}>
          Try Again
        </Link>
        <Link to="/" className="btn-secondary" style={{ textDecoration: 'none' }}>
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

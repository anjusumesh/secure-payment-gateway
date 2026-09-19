import { useEffect, useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../context/useCart.ts';
import { formatCurrency } from '../lib/currency.ts';
import { loadPaypalSdk, renderPaypalButtons } from '../lib/paypal.ts';
import { paymentService } from '../services/paymentService.ts';

type SdkState = 'loading' | 'ready' | 'error';

const CURRENCY = 'USD';

export function PaymentPage() {
  const { lines, total, clear } = useCart();
  const navigate = useNavigate();
  const [sdkState, setSdkState] = useState<SdkState>('loading');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const transactionIdRef = useRef<string | null>(null);

  useEffect(() => {
    const clientId = import.meta.env.VITE_PAYPAL_CLIENT_ID;
    let cancelled = false;

    loadPaypalSdk(clientId, CURRENCY)
      .then(() => {
        if (cancelled || !containerRef.current) return;
        // Guard against React StrictMode's double-invoked effects rendering duplicate buttons.
        containerRef.current.innerHTML = '';

        renderPaypalButtons(containerRef.current, {
          createOrder: async () => {
            setError(null);
            const order = await paymentService.createOrder(
              lines.map((line) => ({ itemId: line.item.id, quantity: line.quantity })),
            );
            transactionIdRef.current = order.transactionId;
            return order.paypalOrderId;
          },
          onApprove: async (data) => {
            setProcessing(true);
            const transactionId = transactionIdRef.current;
            if (!transactionId) {
              setError('Something went wrong starting the checkout. Please try again.');
              setProcessing(false);
              return;
            }

            const result = await paymentService.capture({
              transactionId,
              paypalOrderId: data.orderID,
            });

            clear();
            navigate(result.status === 'DONE' ? '/payment/success' : '/payment/error', {
              state: { transactionId },
            });
          },
          onCancel: () => {
            const transactionId = transactionIdRef.current;
            if (transactionId) {
              void paymentService.cancel(transactionId);
            }
            navigate('/payment/error', { state: { transactionId } });
          },
          onError: () => {
            setError('Something went wrong with PayPal Checkout. Please try again.');
            setProcessing(false);
          },
        });

        setSdkState('ready');
      })
      .catch(() => {
        if (!cancelled) setSdkState('error');
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (lines.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  return (
    <div className="container" style={{ paddingBlock: 24, maxWidth: 480 }}>
      <h1>Payment</h1>
      <p>You're about to pay for {lines.length} item(s) via PayPal.</p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontWeight: 600,
          padding: '16px 0',
          borderTop: '1px solid var(--color-border)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 20,
        }}
      >
        <span>Total</span>
        <span>{formatCurrency(total, CURRENCY)}</span>
      </div>

      {sdkState === 'loading' && <p>Loading PayPal Checkout…</p>}
      {sdkState === 'error' && (
        <p style={{ color: 'var(--color-status-failed)' }} role="alert">
          Couldn't load PayPal Checkout. Please refresh and try again.
        </p>
      )}

      <div
        ref={containerRef}
        style={{ opacity: processing ? 0.5 : 1, pointerEvents: processing ? 'none' : 'auto' }}
      />

      {processing && <p>Finalizing your payment…</p>}

      {error && (
        <p style={{ color: 'var(--color-status-failed)', marginTop: 12 }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useCart } from '../context/useCart.ts';
import { formatCurrency } from '../lib/currency.ts';
import { loadRazorpayCheckout, openRazorpayCheckout } from '../lib/razorpay.ts';
import { paymentService } from '../services/paymentService.ts';

type PayState = 'idle' | 'creating-order' | 'awaiting-payment';

export function PaymentPage() {
  const { lines, total, clear } = useCart();
  const navigate = useNavigate();
  const [payState, setPayState] = useState<PayState>('idle');
  const [error, setError] = useState<string | null>(null);

  if (lines.length === 0) {
    return <Navigate to="/cart" replace />;
  }

  const handlePay = async () => {
    setError(null);
    setPayState('creating-order');

    try {
      const order = await paymentService.createOrder(
        lines.map((line) => ({ itemId: line.item.id, quantity: line.quantity })),
      );

      await loadRazorpayCheckout();
      setPayState('awaiting-payment');

      openRazorpayCheckout({
        key: order.keyId,
        order_id: order.razorpayOrderId,
        amount: order.amount,
        currency: order.currency,
        name: 'Sports Store',
        description: 'Secure test-mode checkout',
        theme: { color: '#14213d' },
        handler: (response) => {
          void (async () => {
            const result = await paymentService.verify({
              transactionId: order.transactionId,
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            });

            clear();
            if (result.status === 'DONE') {
              navigate('/payment/success', { state: { transactionId: order.transactionId } });
            } else {
              navigate('/payment/error', { state: { transactionId: order.transactionId } });
            }
          })();
        },
        modal: {
          ondismiss: () => {
            void paymentService.cancel(order.transactionId).finally(() => {
              navigate('/payment/error', { state: { transactionId: order.transactionId } });
            });
          },
        },
      });
    } catch {
      setError('Could not start the checkout. Please try again.');
      setPayState('idle');
    }
  };

  const isBusy = payState !== 'idle';

  return (
    <div className="container" style={{ paddingBlock: 24, maxWidth: 480 }}>
      <h1>Payment</h1>
      <p>You're about to pay for {lines.length} item(s).</p>

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
        <span>{formatCurrency(total)}</span>
      </div>

      <button
        type="button"
        className="btn-primary"
        style={{ width: '100%' }}
        disabled={isBusy}
        onClick={() => void handlePay()}
      >
        {payState === 'creating-order' && 'Preparing checkout…'}
        {payState === 'awaiting-payment' && 'Waiting for payment…'}
        {payState === 'idle' && 'Pay Now'}
      </button>

      {error && (
        <p style={{ color: 'var(--color-status-failed)', marginTop: 12 }} role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

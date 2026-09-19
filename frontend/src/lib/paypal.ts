// Loaded only from PayPal's official domain — see specs/frontend-spec.md UX/Security.
// Unlike Razorpay, the client id must be known *before* any order exists, since
// it's baked into the SDK script URL itself (specs/frontend-spec.md Deployment).
const SDK_SCRIPT_SRC = 'https://www.paypal.com/sdk/js';

export interface PaypalButtonsOptions {
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void> | void;
  onCancel?: () => void;
  onError?: (err: unknown) => void;
  style?: { color?: string; shape?: string; layout?: string; label?: string };
}

interface PaypalButtonsInstance {
  render: (container: string | HTMLElement) => void;
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: PaypalButtonsOptions) => PaypalButtonsInstance;
    };
  }
}

let loadPromise: Promise<void> | null = null;

export function loadPaypalSdk(clientId: string, currency: string): Promise<void> {
  if (window.paypal) {
    return Promise.resolve();
  }

  if (!loadPromise) {
    loadPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      const params = new URLSearchParams({ 'client-id': clientId, currency, intent: 'capture' });
      script.src = `${SDK_SCRIPT_SRC}?${params.toString()}`;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        loadPromise = null;
        reject(new Error('Failed to load the PayPal SDK'));
      };
      document.body.appendChild(script);
    });
  }

  return loadPromise;
}

export function renderPaypalButtons(container: string | HTMLElement, options: PaypalButtonsOptions): void {
  if (!window.paypal) {
    throw new Error('PayPal SDK has not been loaded yet');
  }
  window.paypal.Buttons(options).render(container);
}

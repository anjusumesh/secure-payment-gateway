/** Mirrors specs/api-contract.md's Item and Transaction schemas. */

export interface Item {
  id: string;
  name: string;
  code: string;
  imageUrl: string;
  /** Integer, smallest currency unit (e.g. cents). */
  price: number;
}

export interface CartLine {
  item: Item;
  quantity: number;
}

export type TransactionStatus = 'INITIATED' | 'DONE' | 'FAILED' | 'CANCELLED';
export type PaymentMethod = 'paypal';

export interface TransactionSummary {
  id: string;
  status: TransactionStatus;
  amount: number;
  currency: string;
  createdAt: string;
}

export interface TransactionItemLine {
  itemId: string;
  name: string;
  unitPrice: number;
  quantity: number;
}

export interface TransactionDetail extends TransactionSummary {
  items: TransactionItemLine[];
  paymentMethod: PaymentMethod | null;
  failureReason: string | null;
}

export interface CreateOrderResponse {
  transactionId: string;
  paypalOrderId: string;
  amount: number;
  currency: string;
  clientId: string;
}

export interface CapturePaymentRequest {
  transactionId: string;
  paypalOrderId: string;
}

export interface CapturePaymentResponse {
  status: TransactionStatus;
  reason?: string;
}

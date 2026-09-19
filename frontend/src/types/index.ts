/** Mirrors specs/api-contract.md's Item and Transaction schemas. */

export interface Item {
  id: string;
  name: string;
  code: string;
  imageUrl: string;
  /** Integer, smallest currency unit (paise). */
  price: number;
}

export interface CartLine {
  item: Item;
  quantity: number;
}

export type TransactionStatus = 'INITIATED' | 'DONE' | 'FAILED' | 'CANCELLED';
export type PaymentMethod = 'card' | 'upi' | 'netbanking';

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
  razorpayOrderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface VerifyPaymentRequest {
  transactionId: string;
  razorpayOrderId: string;
  razorpayPaymentId: string;
  razorpaySignature: string;
}

export interface VerifyPaymentResponse {
  status: TransactionStatus;
  reason?: string;
}

import { api } from './api.ts';
import type {
  CreateOrderResponse,
  VerifyPaymentRequest,
  VerifyPaymentResponse,
} from '../types/index.ts';

export interface CreateOrderItem {
  itemId: string;
  quantity: number;
}

export const paymentService = {
  async createOrder(items: CreateOrderItem[]): Promise<CreateOrderResponse> {
    const { data } = await api.post<CreateOrderResponse>('/payment/create-order', { items });
    return data;
  },

  async verify(payload: VerifyPaymentRequest): Promise<VerifyPaymentResponse> {
    const { data } = await api.post<VerifyPaymentResponse>('/payment/verify', payload);
    return data;
  },

  async cancel(transactionId: string): Promise<{ status: string }> {
    const { data } = await api.post<{ status: string }>('/payment/cancel', { transactionId });
    return data;
  },
};

import { api } from './api.ts';
import type {
  CapturePaymentRequest,
  CapturePaymentResponse,
  CreateOrderResponse,
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

  async capture(payload: CapturePaymentRequest): Promise<CapturePaymentResponse> {
    const { data } = await api.post<CapturePaymentResponse>('/payment/capture', payload);
    return data;
  },

  async cancel(transactionId: string): Promise<{ status: string }> {
    const { data } = await api.post<{ status: string }>('/payment/cancel', { transactionId });
    return data;
  },
};

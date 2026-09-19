import { api } from './api.ts';
import type { TransactionDetail } from '../types/index.ts';

export const transactionsService = {
  async getById(id: string): Promise<TransactionDetail> {
    const { data } = await api.get<TransactionDetail>(`/transactions/${id}`);
    return data;
  },
};

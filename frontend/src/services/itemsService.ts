import { api } from './api.ts';
import type { Item } from '../types/index.ts';

export const itemsService = {
  async getAll(): Promise<Item[]> {
    const { data } = await api.get<Item[]>('/items');
    return data;
  },
};

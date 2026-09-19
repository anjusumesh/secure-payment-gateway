import { createContext } from 'react';
import type { CartLine, Item } from '../types/index.ts';

export interface CartContextValue {
  lines: CartLine[];
  itemCount: number;
  total: number;
  addItem: (item: Item) => void;
  removeItem: (itemId: string) => void;
  setQuantity: (itemId: string, quantity: number) => void;
  clear: () => void;
}

export const CartContext = createContext<CartContextValue | undefined>(undefined);

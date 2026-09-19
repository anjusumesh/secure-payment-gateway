import { useContext } from 'react';
import { CartContext, type CartContextValue } from './cart-context.ts';

export function useCart(): CartContextValue {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

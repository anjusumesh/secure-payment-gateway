import { Route, Routes } from 'react-router-dom';
import { Header } from './components/Header.tsx';
import { CartProvider } from './context/CartContext.tsx';
import { CartPage } from './pages/CartPage.tsx';
import { ItemListPage } from './pages/ItemListPage.tsx';
import { PaymentErrorPage } from './pages/PaymentErrorPage.tsx';
import { PaymentPage } from './pages/PaymentPage.tsx';
import { PaymentSuccessPage } from './pages/PaymentSuccessPage.tsx';

function App() {
  return (
    <CartProvider>
      <Header />
      <main style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<ItemListPage />} />
          <Route path="/cart" element={<CartPage />} />
          <Route path="/payment" element={<PaymentPage />} />
          <Route path="/payment/success" element={<PaymentSuccessPage />} />
          <Route path="/payment/error" element={<PaymentErrorPage />} />
        </Routes>
      </main>
    </CartProvider>
  );
}

export default App;

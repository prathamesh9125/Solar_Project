import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { useState, createContext, useContext } from "react";
import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import StatsBar from "./components/StatsBar";
import Services from "./components/Services";
import Products from "./components/Products";
import Calculator from "./components/Calculator";
import MapSection from "./components/MapSection";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import AdminDashboard from "./pages/AdminDashboard";
import AdminLogin from "./pages/AdminLogin";
import Toast from "./components/Toast";
import Gallery from './pages/Gallery';
import CartSidebar from "./components/CartSidebar";


export const ToastCtx = createContext(null);
export function useToast() {
  return useContext(ToastCtx);
}

export const CartCtx = createContext(null);
export function useCart() {
  return useContext(CartCtx);
}

function HomePage() {
  return (
    <>
      <Hero />
      <StatsBar />
      <Services />
      <Products />
      <Calculator />
      <MapSection />
      <Contact />
      <Footer />
    </>
  );
}

export default function App() {
  const [toasts, setToasts] = useState([]);
  const [cart, setCart] = useState([]);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addToast = (msg, icon = "✅") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, msg, icon }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  };

  const addToCart = (product) => {
    setCart((prev) => [...prev, product]);
  };

  const removeFromCart = (index) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const clearCart = () => setCart([]);

  const cartValue = {
    cart,
    addToCart,
    removeFromCart,
    clearCart,
    isCartOpen,
    setIsCartOpen
  };

  const [isAuth, setIsAuth] = useState(!!localStorage.getItem("token"));
  const location = useLocation();
  const hideNav = location.pathname === '/admin' || location.pathname === '/login';

  return (
    <ToastCtx.Provider value={addToast}>
      <CartCtx.Provider value={cartValue}>
        {!hideNav && <Navbar />}
        {!hideNav && <CartSidebar />}

      <Routes>
        <Route path="/" element={<HomePage />} />

        {/* LOGIN */}
        <Route path="/login" element={<AdminLogin setIsAuth={setIsAuth} />} />

        <Route
          path="/admin"
          element={isAuth ? <AdminDashboard /> : <Navigate to="/login" />}
        />
        <Route path="/gallery" element={<Gallery />} />
      </Routes>

      <Toast toasts={toasts} />
      </CartCtx.Provider>
    </ToastCtx.Provider>
  );
}
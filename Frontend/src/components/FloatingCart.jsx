import { useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../store/CartContext';
import { ghs } from '../utils/money';
import './FloatingCart.css';

// Routes that already show cart prominently or where the FAB would clash
// (product pages have their own purchase bar; chat has its input row).
const HIDE_ON = ['/cart', '/checkout', '/payment-success', '/login', '/signup', '/', '/admin', '/product', '/chat', '/sell'];

export default function FloatingCart() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { count, subtotal } = useCart();
  const draggedRef = useRef(false);

  const hidden = count === 0 || HIDE_ON.some((p) => pathname === p || pathname.startsWith(p + '/'));

  const handleClick = () => {
    // Suppress tap-to-open when the user just finished dragging.
    if (draggedRef.current) { draggedRef.current = false; return; }
    navigate('/cart');
  };

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.button
          className="fab-cart"
          onClick={handleClick}
          drag
          dragMomentum={false}
          dragElastic={0.15}
          dragConstraints={{ top: -400, bottom: 0, left: -window.innerWidth + 120, right: 0 }}
          onDragStart={() => { draggedRef.current = true; }}
          initial={{ y: 60, opacity: 0, scale: 0.85 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 60, opacity: 0, scale: 0.85 }}
          transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          whileTap={{ scale: 0.94 }}
          whileDrag={{ scale: 1.08, cursor: 'grabbing' }}
          aria-label={`View cart (${count} items). Drag to move.`}
        >
          <span className="fab-icon">
            <ShoppingBag size={20} />
            <motion.span
              key={count}
              className="fab-badge"
              initial={{ scale: 0.4 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 14 }}
            >
              {count}
            </motion.span>
          </span>
          <span className="fab-text">
            <strong>View Cart</strong>
            <span>{ghs(subtotal)}</span>
          </span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

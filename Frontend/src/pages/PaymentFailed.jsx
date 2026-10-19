import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, ShoppingCart, MessageCircle, RotateCcw } from 'lucide-react';
import './PaymentFailed.css';

export default function PaymentFailed() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const reason = searchParams.get('reason') || 'Your payment could not be completed.';
  const reference = searchParams.get('reference') || searchParams.get('trxref');

  const tips = [
    'Check that your card or MoMo number is correct and has sufficient funds.',
    'Try a different payment method — card, Mobile Money or bank transfer all work.',
    'Make sure your network is stable before retrying.',
    'Your cart items are still saved — no stock was reserved.',
  ];

  return (
    <div className="pf-page">
      <motion.div
        className="pf-card"
        initial={{ scale: 0.7, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 18 }}
      >
        <motion.div
          className="pf-icon"
          initial={{ scale: 0, rotate: -45 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 14, delay: 0.15 }}
        >
          <X size={40} color="#fff" strokeWidth={3} />
        </motion.div>

        <motion.h2
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
        >
          Payment not completed
        </motion.h2>

        <motion.p
          className="pf-reason"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.32 }}
        >
          {reason}
        </motion.p>

        <motion.div
          className="pf-tips"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <h4>What you can do</h4>
          <ul>
            {tips.map((tip, i) => (
              <li key={i}>
                <span className="pf-tip-dot">{i + 1}</span>
                {tip}
              </li>
            ))}
          </ul>
        </motion.div>

        <motion.div
          className="pf-actions"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <button
            className="btn btn-primary"
            onClick={() => navigate('/cart')}
          >
            <RotateCcw size={16} /> Try again
          </button>

          <div className="pf-divider"><span>or</span></div>

          <button
            className="btn btn-ghost"
            onClick={() => navigate('/home')}
          >
            <ShoppingCart size={16} /> Keep shopping
          </button>

          <button
            className="btn btn-ghost"
            onClick={() => navigate('/chats')}
          >
            <MessageCircle size={16} /> Contact support
          </button>
        </motion.div>

        {reference && (
          <p className="pf-ref">Ref: {reference}</p>
        )}
      </motion.div>
    </div>
  );
}

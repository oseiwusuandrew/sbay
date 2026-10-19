import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShoppingBag, Heart, Tag, GraduationCap } from 'lucide-react';
import Logo from '../components/Logo';
import { sbay } from '../api/client';
import './Splash.css';

const SPRING = { type: 'spring', stiffness: 120, damping: 14 };

export default function Splash() {
  const navigate = useNavigate();

  useEffect(() => {
    // Prefetch the Home chunk + API data while the splash animates
    import('./Home').catch(() => {});
    sbay.getHomeFeed().catch(() => {});

    const t = setTimeout(() => navigate('/home'), 2400);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="splash kente-bg">
      {/* Decorative corner kente blocks */}
      <div className="splash-corner top-right" />
      <div className="splash-corner bottom-left" />

      {/* Floating outline icons */}
      <ShoppingBag className="float-icon icon-bag" size={26} />
      <Heart       className="float-icon icon-heart" size={24} />
      <Tag         className="float-icon icon-tag" size={26} />

      {/* Centered logo + tagline */}
      <motion.div
        className="splash-center"
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ ...SPRING, delay: 0.1 }}
      >
        <motion.div
          className="splash-mark"
          initial={{ y: -10, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...SPRING, delay: 0.2 }}
        >
          <Logo size="xl" />
        </motion.div>

        <motion.p
          className="splash-tagline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
        >
          Campus Marketplace
          <br />
          Reimagined
        </motion.p>

        {/* Loading dots — green / gold / red */}
        <div className="splash-dots" aria-label="loading">
          {['#0A7E3E', '#F5A623', '#D32F2F'].map((c, i) => (
            <motion.span
              key={c}
              style={{ background: c }}
              animate={{ y: [0, -6, 0], opacity: [0.5, 1, 0.5] }}
              transition={{
                duration: 0.9,
                repeat: Infinity,
                delay: i * 0.15,
              }}
            />
          ))}
        </div>
      </motion.div>

      {/* Footer */}
      <motion.div
        className="splash-footer"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4 }}
      >
        <div className="footer-pill">
          <GraduationCap size={16} color="#F5A623" />
          <span>Made for Ghanaian Students</span>
        </div>
        <p className="footer-version">v2.0 · Buy & Sell Safely</p>
      </motion.div>
    </div>
  );
}

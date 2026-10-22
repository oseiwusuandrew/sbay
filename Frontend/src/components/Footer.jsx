import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, MapPin } from 'lucide-react';
import Logo from './Logo';
import { useAuth } from '../store/AuthContext';
import { useLocation as useCampus } from '../store/LocationContext';
import './Footer.css';

const PAYMENTS = ['MTN MoMo', 'Telecel Cash', 'AirtelTigo Money', 'Visa', 'Mastercard'];

export default function Footer() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { schools, setCampus } = useCampus();
  const campuses = [...schools]
    .filter((s) => s.id !== 'others')
    .sort((a, b) => (b.count || 0) - (a.count || 0))
    .slice(0, 5);
  const isSeller = user?.role === 'seller';

  const shopAt = (school) => {
    setCampus(school);
    navigate('/home');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="site-footer">
      <div className="sf-flag" aria-hidden="true"><span /><span /><span /></div>

      <div className="sf-inner">
        <div className="sf-brand">
          <Link to="/home" aria-label="sBay home"><Logo size="md" tone="light" /></Link>
          <p className="sf-mission">
            Buy and sell with students on your campus. Every payment is held by sBay until the buyer has the item.
          </p>
          <div className="sf-trust">
            <ShieldCheck size={16} aria-hidden />
            <span>Payments by Paystack</span>
          </div>
          <ul className="sf-pay" aria-label="Accepted payment methods">
            {PAYMENTS.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>

        <nav className="sf-cols" aria-label="Footer">
          <div>
            <h4>Shop</h4>
            <Link to="/categories">Categories</Link>
            <Link to="/trending">Trending</Link>
            <Link to="/profile/wishlist">Saved items</Link>
            <Link to="/profile/orders">My orders</Link>
          </div>
          <div>
            <h4>Sell</h4>
            {isSeller ? (
              <>
                <Link to="/sell">List an item</Link>
                <Link to="/seller-dashboard">Seller dashboard</Link>
                <Link to="/seller/subscription">Seller plans</Link>
              </>
            ) : (
              <>
                <Link to="/become-seller">Start selling</Link>
                <Link to="/help#selling">How selling works</Link>
                <Link to="/help#fees">Fees and plans</Link>
              </>
            )}
          </div>
          {campuses.length > 0 && (
            <div>
              <h4>Campuses</h4>
              {campuses.map((s) => (
                <button key={s.id} type="button" className="sf-link" onClick={() => shopAt(s)}>
                  <MapPin size={13} aria-hidden /> {s.label}
                </button>
              ))}
            </div>
          )}
          <div>
            <h4>Help</h4>
            <Link to="/help#buying">How buying works</Link>
            <Link to="/help#safety">Staying safe</Link>
            <Link to="/help#contact">Contact us</Link>
            <Link to="/terms">Terms</Link>
            <Link to="/privacy">Privacy</Link>
          </div>
        </nav>
      </div>

      <div className="sf-base">
        <div className="sf-base-inner">
          <span>© {new Date().getFullYear()} sBay</span>
          <span>
            Built by{' '}
            <a href="https://portfolio-sooty-eight-54.vercel.app/" target="_blank" rel="noopener noreferrer">MiqroTek</a>
          </span>
        </div>
      </div>
    </footer>
  );
}

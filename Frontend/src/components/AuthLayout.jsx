import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ShieldCheck, BadgeCheck, MapPin } from 'lucide-react';
import Logo from './Logo';
import '../pages/Auth.css';

/**
 * Shared shell for sign-in, sign-up, password reset and seller onboarding:
 * a branded panel (desktop) next to the form card.
 */
export default function AuthLayout({ children, title, subtitle, aside }) {
  const navigate = useNavigate();
  return (
    <div className="auth-shell">
      <aside className="auth-brand" aria-hidden="true">
        <Link to="/home" className="auth-brand-logo" tabIndex={-1}><Logo size="lg" tone="light" /></Link>
        <div className="auth-brand-copy">
          <h2>{aside?.title || 'The safest way to buy and sell on campus.'}</h2>
          <p>{aside?.text || 'Student listings from campuses across Ghana, with every payment held safely until the item is in your hands.'}</p>
        </div>
        <ul className="auth-points">
          <li><ShieldCheck size={18} /> Escrow on every order</li>
          <li><BadgeCheck size={18} /> Sellers verified by student ID</li>
          <li><MapPin size={18} /> Meet up on your own campus</li>
        </ul>
        <span className="auth-brand-foot">© {new Date().getFullYear()} sBay · Made for Ghanaian students</span>
      </aside>

      <main className="auth-main">
        <div className="auth-top">
          <button className="round-btn" onClick={() => navigate(-1)} aria-label="Go back"><ArrowLeft size={18} /></button>
          <Link to="/home" className="auth-top-logo" aria-label="sBay home"><Logo size="md" /></Link>
          <span aria-hidden="true" style={{ width: 42 }} />
        </div>
        <div className="auth-card">
          {title && <h1 className="auth-title">{title}</h1>}
          {subtitle && <p className="lede">{subtitle}</p>}
          {children}
        </div>
      </main>
    </div>
  );
}

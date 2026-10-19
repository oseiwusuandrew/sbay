import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';
import Logo from './Logo';
import './Footer.css';

export default function Footer() {
  return (
    <footer className="site-footer">
      <div className="sf-inner">
        <div className="sf-brand">
          <Logo size="sm" />
          <p>The campus marketplace for Ghanaian students. Every order is protected by sBay escrow.</p>
          <span className="sf-trust"><ShieldCheck size={14} /> Payments secured by Paystack</span>
        </div>
        <nav className="sf-cols" aria-label="Footer">
          <div>
            <h4>Shop</h4>
            <Link to="/home">Home</Link>
            <Link to="/categories">Categories</Link>
            <Link to="/trending">Trending</Link>
            <Link to="/profile/wishlist">Saved items</Link>
          </div>
          <div>
            <h4>Sell</h4>
            <Link to="/become-seller">Become a seller</Link>
            <Link to="/seller-dashboard">Seller dashboard</Link>
          </div>
          <div>
            <h4>Help</h4>
            <Link to="/terms">Terms &amp; escrow policy</Link>
            <a href="mailto:support@sbaygh.com">support@sbaygh.com</a>
          </div>
        </nav>
      </div>
      <div className="sf-base">
        <span>© {new Date().getFullYear()} sBay</span>
        <span>
          Built by{' '}
          <a href="https://portfolio-sooty-eight-54.vercel.app/" target="_blank" rel="noopener noreferrer">MiqroTek</a>
        </span>
      </div>
    </footer>
  );
}

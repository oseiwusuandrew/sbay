import { useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import ProductCard, { ProductGrid } from '../components/ProductCard';
import { useWishlist } from '../store/WishlistContext';
import './pages.css';

/**
 * Saved items. This page used to be hard-coded empty; it now reads the
 * on-device wishlist that every heart button writes to.
 */
export default function ProfileWishlist() {
  const navigate = useNavigate();
  const { items } = useWishlist();

  return (
    <div className="page">
      <TopBar showBack showSearch={false} title="Saved items" />
      <main className="page-main">
        <p className="section-sub">{items.length} item{items.length === 1 ? '' : 's'} · saved on this device</p>

        {items.length === 0 ? (
          <div className="empty">
            <span className="empty-ic"><Heart size={26} /></span>
            <h3>Nothing saved yet</h3>
            <p>Tap the heart on any listing to keep it here for later.</p>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>Browse listings</button>
          </div>
        ) : (
          <ProductGrid>
            {items.map((p) => <ProductCard key={p.id} p={p} />)}
          </ProductGrid>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

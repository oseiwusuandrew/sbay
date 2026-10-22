import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Plus, Edit2, Trash2, Eye, Package } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { productApi } from '../api/client';
import { useConfirm } from '../store/ConfirmContext';
import { useToast } from '../components/Feedback';
import './pages.css';
import './SellerDashboard.css';

export default function SellerListings() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listingCat, setListingCat] = useState('all');

  useEffect(() => {
    productApi.mine()
      .then(setListings)
      .catch(() => setListings([]))
      .finally(() => setLoading(false));
  }, []);

  const onDelete = async (id, title) => {
    const ok = await confirm({
      title: 'Delete this listing?',
      body: `"${title}" will be hidden from the marketplace. Existing orders are unaffected.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await productApi.remove(id);
      setListings((ls) => ls.filter((l) => l.id !== id));
      toast.success('Listing deleted');
    } catch (e) {
      toast.error(e.message || 'Could not delete this listing.');
    }
  };

  const cats = ['all', ...new Set(listings.map((l) => l.categoryId).filter(Boolean))];
  const visible = listings.filter((l) =>
    listingCat === 'all' ? true : l.categoryId === listingCat
  );

  return (
    <div className="page">
      <TopBar showBack title="My listings" showSearch={false} />
      <main className="page-main">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <p className="muted small">{listings.length} listing{listings.length !== 1 ? 's' : ''}</p>
          <button className="btn btn-primary" onClick={() => navigate('/sell')}>
            <Plus size={15} /> New listing
          </button>
        </div>

        {!loading && listings.length === 0 && (
          <div className="empty">
            <span className="empty-ic"><Package size={26} /></span>
            <h3>No listings yet</h3>
            <p>Create your first listing to start selling.</p>
            <button className="btn btn-primary" onClick={() => navigate('/sell')}>
              <Plus size={16} /> Create listing
            </button>
          </div>
        )}

        {cats.length > 1 && (
          <div className="sd-listing-filter">
            {cats.map((c) => (
              <button
                key={c}
                className={`sd-filter-pill ${listingCat === c ? 'active' : ''}`}
                onClick={() => setListingCat(c)}
              >
                {c === 'all' ? 'All' : c.charAt(0).toUpperCase() + c.slice(1)}
              </button>
            ))}
          </div>
        )}

        <div className="sd-listings">
          {visible.map((p, i) => (
            <motion.article
              key={p.id}
              className="sd-listing"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
            >
              <div className="sd-thumb" style={{ backgroundImage: `url(${p.image})` }} />
              <div className="sd-meta">
                <h4>{p.title}</h4>
                <p className="muted small">
                  {p.tag || p.condition} · {p.stock ?? 0} in stock
                  {p.status && p.status !== 'active' && ` · ${p.status}`}
                </p>
                <span className="price">GH₵ {p.price.toLocaleString()}</span>
              </div>
              <div className="sd-actions">
                <button className="iac" onClick={() => navigate(`/product/${p.id}`)} aria-label="View">
                  <Eye size={16} />
                </button>
                <button className="iac" onClick={() => navigate(`/seller/listing/${p.id}/edit`)} aria-label="Edit">
                  <Edit2 size={16} />
                </button>
                <button className="iac danger" onClick={() => onDelete(p.id, p.title)} aria-label="Delete">
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.article>
          ))}
          {listings.length > 0 && visible.length === 0 && (
            <div className="empty">
              <Package size={48} color="#C9D4BD" />
              <h3>No listings in this category</h3>
              <button className="chip" onClick={() => setListingCat('all')}>Show all</button>
            </div>
          )}
        </div>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

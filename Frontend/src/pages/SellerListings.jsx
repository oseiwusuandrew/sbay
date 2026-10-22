import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Package, Eye, CheckCircle2, RotateCcw } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { SkeletonList } from '../components/Skeleton';
import { Notice, useToast } from '../components/Feedback';
import { productApi, sbay } from '../api/client';
import { useConfirm } from '../store/ConfirmContext';
import { ghs } from '../utils/money';
import './pages.css';
import './SellerDashboard.css';

const TABS = [
  ['active', 'For sale'],
  ['sold_out', 'Sold'],
  ['hidden', 'Hidden by sBay'],
];
const STATUS_TEXT = { active: 'For sale', sold_out: 'Sold', hidden: 'Hidden by sBay' };

/** A seller's own listings, with quick actions to edit, mark sold, relist or delete. */
export default function SellerListings() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const toast = useToast();
  const [listings, setListings] = useState(null);
  const [tab, setTab] = useState('active');
  const [busy, setBusy] = useState('');

  useEffect(() => {
    productApi.mine().then(setListings).catch(() => setListings([]));
  }, []);

  const counts = useMemo(() => Object.fromEntries(TABS.map(([id]) => [id, (listings || []).filter((l) => l.status === id).length])), [listings]);
  const visible = (listings || []).filter((l) => l.status === tab);

  const replace = (updated) => setListings((ls) => ls.map((l) => (l.id === updated.id ? updated : l)));

  const setStock = async (p, stock, message) => {
    setBusy(p.id);
    try {
      replace(await productApi.update(p.id, { stock }));
      sbay.clearListingCache();
      toast.success(message);
    } catch (e) {
      toast.error(e.message || 'Could not update the listing.');
    } finally {
      setBusy('');
    }
  };

  const onDelete = async (p) => {
    const ok = await confirm({
      title: 'Delete this listing?',
      body: `"${p.title}" will be removed from sBay. Orders already placed are not affected.`,
      confirmLabel: 'Delete',
      danger: true,
    });
    if (!ok) return;
    try {
      await productApi.remove(p.id);
      setListings((ls) => ls.filter((l) => l.id !== p.id));
      sbay.clearListingCache();
      toast.success('Listing deleted');
    } catch (e) {
      toast.error(e.message || 'Could not delete this listing.');
    }
  };

  return (
    <div className="page">
      <TopBar showBack title="Listings" showSearch={false} />
      <main className="page-main sd-sub">
        <div className="sd-sub-head">
          <div className="sd-tabs" role="tablist" aria-label="Filter listings">
            {TABS.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={`chip ${tab === id ? 'active' : ''}`} onClick={() => setTab(id)}>
                {label}{counts[id] > 0 && <span className="chip-count">{counts[id]}</span>}
              </button>
            ))}
          </div>
          <button className="btn btn-primary" onClick={() => navigate('/sell')}><Plus size={16} /> New listing</button>
        </div>

        {tab === 'hidden' && counts.hidden > 0 && (
          <Notice tone="warning">The sBay team hid these listings. <Link to="/help#contact">Contact us</Link> if you think that's a mistake.</Notice>
        )}

        {listings === null ? <SkeletonList count={4} /> : visible.length === 0 ? (
          <div className="empty">
            <span className="empty-ic"><Package size={26} /></span>
            <h3>{tab === 'active' ? 'Nothing for sale yet' : tab === 'sold_out' ? 'Nothing sold yet' : 'No hidden listings'}</h3>
            {tab === 'active' && (
              <>
                <p>List something you no longer need. It takes about a minute.</p>
                <button className="btn btn-primary" onClick={() => navigate('/sell')}><Plus size={16} /> List an item</button>
              </>
            )}
          </div>
        ) : (
          <ul className="sd-items">
            {visible.map((p) => (
              <li key={p.id} className="sd-item">
                <Link to={`/product/${p.id}`} className="sd-item-thumb"><img src={p.image} alt="" loading="lazy" /></Link>
                <div className="sd-item-body">
                  <Link to={`/product/${p.id}`} className="sd-item-title">{p.title}</Link>
                  <div className="sd-item-meta">
                    <strong>{ghs(p.price)}</strong>
                    <span>{STATUS_TEXT[p.status]}{p.status === 'active' ? ` · ${p.stock} left` : ''}</span>
                    <span className="sd-item-views"><Eye size={13} aria-hidden="true" /> {p.views || 0}</span>
                  </div>
                </div>
                <div className="sd-item-actions">
                  {p.status === 'active' && (
                    <button className="btn btn-ghost btn-sm" disabled={busy === p.id} onClick={() => setStock(p, 0, 'Marked as sold')}>
                      <CheckCircle2 size={15} /> Mark sold
                    </button>
                  )}
                  {p.status === 'sold_out' && (
                    <button className="btn btn-ghost btn-sm" disabled={busy === p.id} onClick={() => setStock(p, 1, 'Back on sale')}>
                      <RotateCcw size={15} /> Relist
                    </button>
                  )}
                  <button className="icon-action" onClick={() => navigate(`/seller/listing/${p.id}/edit`)} aria-label={`Edit ${p.title}`}><Pencil size={16} /></button>
                  <button className="icon-action icon-action--danger" onClick={() => onDelete(p)} aria-label={`Delete ${p.title}`}><Trash2 size={16} /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

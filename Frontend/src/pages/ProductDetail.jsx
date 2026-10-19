import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Heart, Share2, Star, ShoppingCart, Check, ShieldCheck, Copy, X, Send, Mail,
  MapPin, ChevronLeft, ChevronRight, Minus, Plus, BadgeCheck, Pencil, PackageX, Zap, Eye,
} from 'lucide-react';
import { sbay } from '../api/client';
import { useCart } from '../store/CartContext';
import { useAuth } from '../store/AuthContext';
import { useWishlist } from '../store/WishlistContext';
import ProductCard, { ProductRail } from '../components/ProductCard';
import Avatar from '../components/Avatar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { Skeleton } from '../components/Skeleton';
import { ghs } from '../utils/money';
import './pages.css';
import './ProductDetail.css';

/* Inline brand SVGs — lucide-react doesn't ship brand icons. */
const WhatsAppIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} fill="currentColor" aria-hidden="true">
    <path d="M20.52 3.48A11.78 11.78 0 0012.05 0C5.46 0 .1 5.36.1 11.95c0 2.1.55 4.15 1.6 5.96L0 24l6.26-1.64a11.93 11.93 0 005.79 1.48h.01c6.59 0 11.95-5.36 11.95-11.95 0-3.19-1.24-6.18-3.49-8.41zM12.06 21.8h-.01a9.83 9.83 0 01-5.01-1.37l-.36-.21-3.72.97 1-3.62-.23-.37a9.87 9.87 0 01-1.5-5.25c0-5.47 4.46-9.92 9.93-9.92 2.65 0 5.14 1.03 7.02 2.91a9.88 9.88 0 012.9 7.02c0 5.47-4.45 9.92-9.92 9.92zm5.44-7.44c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.95 1.17-.17.2-.35.22-.65.08-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.07-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51l-.57-.01c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48 0 1.46 1.07 2.87 1.22 3.07.15.2 2.1 3.21 5.08 4.5.71.31 1.26.49 1.69.63.71.22 1.35.19 1.86.12.57-.08 1.76-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.12-.27-.2-.57-.35z" />
  </svg>
);
const TwitterXIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} fill="currentColor" aria-hidden="true">
    <path d="M18.244 2H21l-6.53 7.46L22.5 22h-6.75l-4.78-6.26L5.3 22H2.54l7-8-7.04-12h6.92l4.32 5.72L18.244 2zm-1.18 18h1.66L7.03 4H5.3l11.764 16z" />
  </svg>
);
const FacebookIcon = (p) => (
  <svg viewBox="0 0 24 24" width={p.size || 22} height={p.size || 22} fill="currentColor" aria-hidden="true">
    <path d="M22 12.06C22 6.52 17.52 2 11.99 2S2 6.52 2 12.06c0 4.98 3.66 9.11 8.44 9.88v-6.99H7.9v-2.89h2.54V9.85c0-2.51 1.49-3.9 3.78-3.9 1.09 0 2.24.2 2.24.2v2.47h-1.27c-1.24 0-1.63.77-1.63 1.57v1.88h2.77l-.44 2.89h-2.33V22c4.78-.77 8.44-4.9 8.44-9.94z" />
  </svg>
);

const RV_KEY = 'sbay.recentlyViewed.v2';
function readRecentlyViewed() {
  try {
    const v = JSON.parse(localStorage.getItem(RV_KEY));
    return Array.isArray(v) ? v : [];
  } catch { return []; }
}
/** Store small snapshots (not just ids) so the rail works beyond page 1. */
function pushRecentlyViewed(p) {
  const snap = {
    id: p.id, title: p.title, price: p.price, discountPrice: p.discountPrice,
    image: p.image, school: p.school, city: p.city, condition: p.condition, status: p.status,
  };
  const next = [snap, ...readRecentlyViewed().filter((x) => x.id !== p.id)].slice(0, 12);
  try { localStorage.setItem(RV_KEY, JSON.stringify(next)); } catch { /* ignore */ }
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addItem, items: cartItems } = useCart();
  const { user } = useAuth();
  const { has, toggle } = useWishlist();

  const [product, setProduct] = useState(null);
  const [error, setError] = useState('');
  const [seller, setSeller] = useState(null);
  const [activeImg, setActiveImg] = useState(0);
  const [qty, setQty] = useState(1);
  const [toastMsg, setToastMsg] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [similar, setSimilar] = useState([]);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [touchStartX, setTouchStartX] = useState(null);

  useEffect(() => {
    let alive = true;
    setProduct(null);
    setError('');
    setSeller(null);
    setActiveImg(0);
    setQty(1);
    setSimilar([]);

    sbay.getProduct(id)
      .then((p) => {
        if (!alive) return;
        setProduct(p);
        setRecentlyViewed(readRecentlyViewed().filter((x) => x.id !== p.id).slice(0, 10));
        pushRecentlyViewed(p);

        if (p.sellerId) {
          sbay.getSeller(p.sellerId).then((s) => { if (alive) setSeller(s); }).catch(() => {});
        }
        sbay.getAllProducts({ category: p.category, limit: 12 })
          .then((rows) => {
            if (!alive) return;
            const same = rows.filter((x) => x.id !== p.id);
            if (same.length >= 4) { setSimilar(same.slice(0, 10)); return; }
            sbay.getAllProducts({ sort: 'popular', limit: 12 }).then((more) => {
              if (!alive) return;
              const seen = new Set([p.id, ...same.map((x) => x.id)]);
              setSimilar([...same, ...more.filter((x) => !seen.has(x.id))].slice(0, 10));
            }).catch(() => { if (alive) setSimilar(same); });
          })
          .catch(() => {});
      })
      .catch((e) => {
        if (!alive) return;
        setError(e.status === 404 || e.status === 400
          ? 'This listing has been removed or is no longer available.'
          : (e.message || 'Could not load this listing.'));
      });
    return () => { alive = false; };
  }, [id]);

  const inCart = useMemo(() => cartItems.find((i) => i.id === product?.id)?.qty || 0, [cartItems, product]);

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 1900);
  };

  if (error) {
    return (
      <div className="page">
        <main className="page-main">
          <button className="round-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
          <div className="empty">
            <span className="empty-ic"><PackageX size={26} /></span>
            <h3>Listing unavailable</h3>
            <p>{error}</p>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>Browse other listings</button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="page pdp">
        <main className="page-main">
          <div className="pdp-layout">
            <Skeleton h={420} r={20} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Skeleton w="80%" h={30} />
              <Skeleton w="40%" h={26} />
              <Skeleton h={160} r={16} />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const images = product.images?.length ? product.images : [product.image];
  const isOwner = !!user && String(user.id) === String(product.sellerId);
  const soldOut = product.status !== 'active' || (product.stock ?? 0) <= 0;
  const maxQty = Math.max(0, (product.stock ?? 0) - inCart);
  const compareAt = Number(product.discountPrice) > Number(product.price) ? Number(product.discountPrice) : null;
  const savePct = compareAt ? Math.round((1 - product.price / compareAt) * 100) : 0;
  const saved = has(product.id);
  const where = [product.school, product.city].filter(Boolean).join(', ') || product.location;

  const handleAdd = (buyNow = false) => {
    if (soldOut || isOwner) return;
    if (maxQty <= 0) {
      if (buyNow) { navigate('/checkout'); return; }
      showToast(`You already have all ${product.stock} in your cart`);
      return;
    }
    addItem(product, Math.min(qty, maxQty));
    if (buyNow) {
      navigate(user ? '/checkout' : `/login?next=${encodeURIComponent('/checkout')}`);
      return;
    }
    showToast('Added to cart');
    setQty(1);
  };

  const shareUrl = `${window.location.origin}/product/${id}`;
  const shareText = `Check out ${product.title} on sBay: ${ghs(product.price)}`;
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      showToast('Link copied');
    } catch {
      window.prompt('Copy this link:', shareUrl);
    }
    setShareOpen(false);
  };
  const openShare = (href) => { window.open(href, '_blank', 'noopener,noreferrer'); setShareOpen(false); };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: product.title, text: shareText, url: shareUrl });
      setShareOpen(false);
    } catch (err) {
      if (err?.name !== 'AbortError') showToast('Unable to share');
    }
  };

  const go = (dir) => setActiveImg((i) => (i + dir + images.length) % images.length);

  const BuyBox = (
    <>
      {isOwner ? (
        <div className="pdp-owner">
          <p className="muted small">This is your listing.</p>
          <button className="btn btn-primary btn-block" onClick={() => navigate(`/seller/listing/${product.id}/edit`)}>
            <Pencil size={16} /> Edit listing
          </button>
        </div>
      ) : soldOut ? (
        <button className="btn btn-ghost btn-block btn-lg" disabled><PackageX size={18} /> Sold out</button>
      ) : (
        <>
          <div className="pdp-qty-row">
            <span className="field-label">Quantity</span>
            <div className="qty" role="group" aria-label="Quantity">
              <button onClick={() => setQty((q) => Math.max(1, q - 1))} disabled={qty <= 1} aria-label="Decrease quantity"><Minus size={14} /></button>
              <span aria-live="polite">{qty}</span>
              <button onClick={() => setQty((q) => Math.min(Math.max(1, maxQty), q + 1))} disabled={qty >= maxQty} aria-label="Increase quantity"><Plus size={14} /></button>
            </div>
            <span className="muted small">
              {product.stock <= 3 ? `Only ${product.stock} left` : `${product.stock} available`}
              {inCart > 0 && ` · ${inCart} in cart`}
            </span>
          </div>
          <div className="pdp-cta">
            <button className="btn btn-primary btn-lg" onClick={() => handleAdd(true)}>
              <Zap size={18} /> Buy now
            </button>
            <button className="btn btn-ghost btn-lg" onClick={() => handleAdd(false)}>
              <ShoppingCart size={18} /> Add to cart
            </button>
          </div>
        </>
      )}
    </>
  );

  return (
    <div className="page pdp">
      <main className="page-main">
        <nav className="pdp-crumbs" aria-label="Breadcrumb">
          <button className="round-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={18} /></button>
          <Link to="/home">Home</Link>
          <span aria-hidden>/</span>
          <Link to={`/search?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
        </nav>

        <div className="pdp-layout">
          {/* Gallery */}
          <section className="pdp-gallery" aria-label="Photos">
            <div
              className="pdp-stage"
              onTouchStart={(e) => setTouchStartX(e.targetTouches[0].clientX)}
              onTouchEnd={(e) => {
                if (touchStartX === null) return;
                const diff = touchStartX - e.changedTouches[0].clientX;
                if (Math.abs(diff) > 50) go(diff > 0 ? 1 : -1);
                setTouchStartX(null);
              }}
            >
              <img src={images[activeImg]} alt={product.title} />
              {savePct >= 5 && !soldOut && <span className="pcard-flag">-{savePct}%</span>}
              {soldOut && <span className="pcard-flag pcard-flag--muted">Sold out</span>}
              <div className="pdp-stage-actions">
                <button
                  className={`round-btn ${saved ? 'is-saved' : ''}`}
                  onClick={() => { toggle(product); showToast(saved ? 'Removed from wishlist' : 'Saved to wishlist'); }}
                  aria-pressed={saved}
                  aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
                >
                  <Heart size={18} fill={saved ? 'currentColor' : 'none'} />
                </button>
                <button className="round-btn" onClick={() => setShareOpen(true)} aria-label="Share"><Share2 size={18} /></button>
              </div>
              {images.length > 1 && (
                <>
                  <button className="pdp-nav prev" onClick={() => go(-1)} aria-label="Previous photo"><ChevronLeft size={20} /></button>
                  <button className="pdp-nav next" onClick={() => go(1)} aria-label="Next photo"><ChevronRight size={20} /></button>
                  <span className="pdp-count">{activeImg + 1} / {images.length}</span>
                </>
              )}
            </div>
            {images.length > 1 && (
              <div className="pdp-thumbs">
                {images.map((img, i) => (
                  <button
                    key={img + i}
                    className={`pdp-thumb ${i === activeImg ? 'active' : ''}`}
                    onClick={() => setActiveImg(i)}
                    aria-label={`Photo ${i + 1}`}
                    aria-current={i === activeImg}
                  >
                    <img src={img} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Buy box */}
          <aside className="pdp-info">
            <div className="pdp-chips">
              {product.condition && <span className="pcard-cond">{product.condition}</span>}
              {where && <span className="badge-soft"><MapPin size={12} /> {where}</span>}
              {product.views > 0 && <span className="badge-soft"><Eye size={12} /> {product.views} views</span>}
            </div>
            <h1 className="pdp-title">{product.title}</h1>
            <div className="pdp-price">
              <strong>{ghs(product.price)}</strong>
              {compareAt && <s>{ghs(compareAt)}</s>}
              {savePct >= 5 && <span className="pdp-save">Save {ghs(compareAt - product.price)}</span>}
            </div>

            <div className="pdp-buy">{BuyBox}</div>

            <div className="pdp-escrow">
              <ShieldCheck size={20} aria-hidden />
              <div>
                <strong>Protected by sBay escrow</strong>
                <p>Pay with MoMo or card. The seller is only paid after you confirm you received this item.</p>
              </div>
            </div>

            {seller && (
              <Link to={`/seller/${seller.id}`} className="pdp-seller">
                <Avatar src={seller.avatar} name={seller.name} size={48} />
                <div className="pdp-seller-info">
                  <strong>
                    {seller.name}
                    {seller.verified && <BadgeCheck size={15} className="pcard-verified" aria-label="Verified seller" />}
                  </strong>
                  <span className="seller-tile-rating">
                    <Star size={13} fill="currentColor" aria-hidden /> {Number(seller.rating || 0).toFixed(1)}
                    <em>({seller.reviews} review{seller.reviews === 1 ? '' : 's'})</em>
                  </span>
                  {seller.location && <span className="muted small">{seller.location}</span>}
                </div>
                <span className="view-all">View shop <ChevronRight size={14} /></span>
              </Link>
            )}
          </aside>
        </div>

        <section className="card pdp-desc">
          <h2 className="page-h2">About this item</h2>
          <p>{product.description || 'The seller has not added a description yet.'}</p>
          <dl className="pdp-specs">
            <div><dt>Condition</dt><dd>{product.condition || '—'}</dd></div>
            <div><dt>Category</dt><dd>{product.category || '—'}</dd></div>
            <div><dt>Campus</dt><dd>{product.school || '—'}</dd></div>
            <div><dt>Pickup / delivery</dt><dd>{product.location || where || 'Arrange with seller'}</dd></div>
          </dl>
        </section>

        {similar.length > 0 && (
          <section className="section">
            <div className="section-head"><h2 className="section-title">You might also like</h2></div>
            <ProductRail label="Similar listings">
              {similar.map((s) => <ProductCard key={s.id} p={s} variant="rail" />)}
            </ProductRail>
          </section>
        )}

        {recentlyViewed.length > 0 && (
          <section className="section">
            <div className="section-head"><h2 className="section-title">Recently viewed</h2></div>
            <ProductRail label="Recently viewed">
              {recentlyViewed.map((s) => <ProductCard key={s.id} p={s} variant="rail" />)}
            </ProductRail>
          </section>
        )}
      </main>

      {/* Mobile sticky purchase bar */}
      {!isOwner && (
        <div className="pdp-mobilebar">
          <div className="pdp-mobilebar-price">
            <strong>{ghs(product.price)}</strong>
            {compareAt && <s>{ghs(compareAt)}</s>}
          </div>
          {soldOut ? (
            <button className="btn btn-ghost" disabled>Sold out</button>
          ) : (
            <>
              <button className="btn btn-ghost" onClick={() => handleAdd(false)} aria-label="Add to cart"><ShoppingCart size={18} /></button>
              <button className="btn btn-primary" onClick={() => handleAdd(true)}>Buy now</button>
            </>
          )}
        </div>
      )}

      <AnimatePresence>
        {toastMsg && (
          <motion.div
            className="toast"
            role="status"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -16 }}
          >
            <Check size={16} /> {toastMsg}
            {toastMsg === 'Added to cart' && <Link to="/cart" className="toast-link">View cart</Link>}
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {shareOpen && (
          <>
            <motion.div className="share-overlay" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShareOpen(false)} />
            <motion.div
              className="share-sheet"
              role="dialog"
              aria-label="Share this item"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            >
              <header className="share-head">
                <h3>Share this item</h3>
                <button onClick={() => setShareOpen(false)} aria-label="Close"><X size={20} /></button>
              </header>
              <div className="share-grid">
                <button className="share-opt whatsapp" onClick={() => openShare(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`)}>
                  <span className="share-ic"><WhatsAppIcon size={22} /></span><span>WhatsApp</span>
                </button>
                <button className="share-opt twitter" onClick={() => openShare(`https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`)}>
                  <span className="share-ic"><TwitterXIcon size={22} /></span><span>X</span>
                </button>
                <button className="share-opt facebook" onClick={() => openShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`)}>
                  <span className="share-ic"><FacebookIcon size={22} /></span><span>Facebook</span>
                </button>
                <button className="share-opt telegram" onClick={() => openShare(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`)}>
                  <span className="share-ic"><Send size={22} /></span><span>Telegram</span>
                </button>
                <button className="share-opt email" onClick={() => openShare(`mailto:?subject=${encodeURIComponent(product.title)}&body=${encodeURIComponent(`${shareText}\n\n${shareUrl}`)}`)}>
                  <span className="share-ic"><Mail size={22} /></span><span>Email</span>
                </button>
                <button className="share-opt copy" onClick={copyLink}>
                  <span className="share-ic"><Copy size={22} /></span><span>Copy link</span>
                </button>
                {typeof navigator !== 'undefined' && navigator.share && (
                  <button className="share-opt more" onClick={nativeShare}>
                    <span className="share-ic"><Share2 size={22} /></span><span>More…</span>
                  </button>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <Footer />
      <BottomNav />
    </div>
  );
}

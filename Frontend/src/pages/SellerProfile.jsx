import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Star, MapPin, Send, BadgeCheck, Clock, Loader2, Share2, Package, MessageSquareText, PenLine, Check,
} from 'lucide-react';
import { sbay } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { Skeleton, SkeletonGrid } from '../components/Skeleton';
import ProductCard, { ProductGrid } from '../components/ProductCard';
import Avatar from '../components/Avatar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import { Notice } from '../components/Feedback';
import './pages.css';
import './SellerProfile.css';

function Stars({ value, size = 14 }) {
  return (
    <span className="stars" aria-label={`${Number(value || 0).toFixed(1)} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          fill={n <= Math.round(value) ? 'currentColor' : 'transparent'}
          className={n <= Math.round(value) ? 'on' : 'off'}
          aria-hidden
        />
      ))}
    </span>
  );
}

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/**
 * Seller storefront. Listings and reviews are shown together — reviews
 * used to sit behind a tab and weren't even fetched until it was opened,
 * so buyers never saw a seller's reputation while browsing their items.
 */
export default function SellerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [seller, setSeller] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [reviews, setReviews] = useState({ items: [], total: 0, rating: 0, distribution: [], page: 1 });
  const [reviewsLoading, setReviewsLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [writing, setWriting] = useState(false);
  const [draft, setDraft] = useState({ rating: 5, text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [reviewMsg, setReviewMsg] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    setSeller(null);
    setLoadError('');
    sbay.getSeller(id)
      .then((data) => { if (alive) setSeller(data); })
      .catch((e) => {
        if (!alive) return;
        setLoadError(e.status === 404 ? 'This seller could not be found.' : (e.message || 'Could not load this seller.'));
      });
    return () => { alive = false; };
  }, [id]);

  const loadReviews = useCallback(async (page = 1) => {
    const data = await sbay.getSellerReviews(id, page);
    setReviews((cur) => ({
      items: page === 1 ? (data.items || []) : [...cur.items, ...(data.items || [])],
      total: Number(data.total) || 0,
      rating: Number(data.rating) || 0,
      distribution: data.distribution || cur.distribution,
      page,
    }));
  }, [id]);

  useEffect(() => {
    setReviewsLoading(true);
    loadReviews(1).catch(() => {}).finally(() => setReviewsLoading(false));
  }, [loadReviews]);

  const loadMore = async () => {
    setMoreLoading(true);
    try { await loadReviews(reviews.page + 1); } catch { /* keep what we have */ }
    finally { setMoreLoading(false); }
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) { navigate('/login?next=' + encodeURIComponent(`/seller/${id}`)); return; }
    if (!draft.text.trim()) return;
    setSubmitting(true);
    setReviewMsg(null);
    try {
      await sbay.submitReview(id, { rating: draft.rating, text: draft.text.trim() });
      await loadReviews(1);
      setDraft({ rating: 5, text: '' });
      setWriting(false);
      setReviewMsg({ ok: true, text: 'Thanks, your review has been posted.' });
    } catch (err) {
      setReviewMsg({ ok: false, text: err.message || 'Could not post your review.' });
    } finally {
      setSubmitting(false);
    }
  };

  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: seller?.name, url });
      else { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    } catch { /* cancelled */ }
  };

  const scrollTo = (sectionId) => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  if (!seller && loadError) {
    return (
      <div className="page">
        <main className="page-main">
          <button className="round-btn" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
          <div className="empty">
            <h3>Seller unavailable</h3>
            <p>{loadError}</p>
            <button className="btn btn-primary" onClick={() => navigate('/home')}>Back to marketplace</button>
          </div>
        </main>
        <BottomNav />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="page sp">
        <div className="sp-hero"><div className="sp-hero-inner"><Skeleton w={96} h={96} r="50%" /><Skeleton w={220} h={26} /></div></div>
        <main className="page-main"><SkeletonGrid count={6} /></main>
      </div>
    );
  }

  const rating = reviews.rating || seller.rating || 0;
  const reviewCount = reviews.total || seller.reviews || 0;
  const isOwner = user && String(user.id) === String(seller.id);
  const maxBar = Math.max(1, ...reviews.distribution.map((d) => d.count));

  return (
    <div className="page sp">
      <header className="sp-hero">
        <div className="sp-hero-inner">
          <button className="round-btn sp-back" onClick={() => navigate(-1)} aria-label="Back"><ArrowLeft size={20} /></button>
          <Avatar src={seller.avatar} name={seller.name} size={96} className="sp-avatar" />
          <div className="sp-id">
            <h1 className="sp-name">
              {seller.name}
              {seller.verified && <BadgeCheck size={22} className="sp-verified" aria-label="Verified seller" />}
            </h1>
            <div className="sp-meta">
              <button className="sp-rating" onClick={() => scrollTo('reviews')}>
                <Stars value={rating} />
                <strong>{rating > 0 ? rating.toFixed(1) : 'New seller'}</strong>
                {reviewCount > 0 && <span>({reviewCount} review{reviewCount === 1 ? '' : 's'})</span>}
              </button>
              {seller.location && <span><MapPin size={14} aria-hidden /> {seller.location}</span>}
              {seller.createdAt && <span><Clock size={14} aria-hidden /> Selling since {new Date(seller.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span>}
            </div>
            {seller.bio && <p className="sp-bio">{seller.bio}</p>}
            <div className="sp-badges">
              {seller.verified
                ? <span className="sp-badge is-verified"><BadgeCheck size={14} /> Verified by sBay</span>
                : <span className="sp-badge is-pending"><Clock size={14} /> Verification in progress</span>}
              <span className="sp-badge"><Package size={14} /> {seller.listings.length} active listing{seller.listings.length === 1 ? '' : 's'}</span>
            </div>
          </div>
          <button className="btn btn-ghost btn-sm sp-share" onClick={share}>
            {copied ? <><Check size={15} /> Link copied</> : <><Share2 size={15} /> Share store</>}
          </button>
        </div>
      </header>

      <nav className="sp-jump" aria-label="Store sections">
        <div className="sp-jump-inner">
          <button className="chip" onClick={() => scrollTo('listings')}>Listings · {seller.listings.length}</button>
          <button className="chip" onClick={() => scrollTo('reviews')}>Reviews · {reviewCount}</button>
        </div>
      </nav>

      <main className="page-main sp-main">
        <section id="listings" className="section sp-listings">
          <div className="section-head"><h2 className="section-title">Listings</h2></div>
          {seller.listings.length === 0 ? (
            <div className="empty empty--compact">
              <h3>Nothing for sale right now</h3>
              <p>Check back soon, or save this store's link.</p>
            </div>
          ) : (
            <ProductGrid dense>
              {seller.listings.map((p) => <ProductCard key={p.id} p={{ ...p, sellerName: undefined }} />)}
            </ProductGrid>
          )}
        </section>

        <aside id="reviews" className="section sp-reviews" aria-labelledby="reviews-title">
          <div className="section-head">
            <h2 id="reviews-title" className="section-title">Reviews</h2>
            {user && !isOwner && !writing && (
              <button className="view-all" onClick={() => setWriting(true)}><PenLine size={14} /> Write a review</button>
            )}
          </div>

          <div className="rv-summary card">
            <div className="rv-score">
              <strong>{rating > 0 ? rating.toFixed(1) : '–'}</strong>
              <Stars value={rating} size={16} />
              <span>{reviewCount} review{reviewCount === 1 ? '' : 's'}</span>
            </div>
            <ul className="rv-bars" aria-label="Rating breakdown">
              {(reviews.distribution.length ? reviews.distribution : [5, 4, 3, 2, 1].map((star) => ({ star, count: 0 }))).map((d) => (
                <li key={d.star}>
                  <span>{d.star}</span>
                  <Star size={11} fill="currentColor" aria-hidden />
                  <span className="rv-bar"><span style={{ width: `${(d.count / maxBar) * 100}%` }} /></span>
                  <span className="rv-n">{d.count}</span>
                </li>
              ))}
            </ul>
          </div>

          {reviewMsg && (
            <Notice tone={reviewMsg.ok ? 'success' : 'error'}>{reviewMsg.text}</Notice>
          )}

          {writing && (
            <form className="card review-form" onSubmit={submitReview}>
              <div className="review-form-head">
                <strong>Rate {seller.name}</strong>
                <span className="muted small">Only buyers who've received an order from this seller can post.</span>
              </div>
              <div className="rating-pick" role="radiogroup" aria-label="Your rating">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    role="radio"
                    aria-checked={draft.rating === n}
                    onClick={() => setDraft((d) => ({ ...d, rating: n }))}
                    aria-label={`${n} star${n > 1 ? 's' : ''}`}
                  >
                    <Star size={24} fill={n <= draft.rating ? 'var(--secondary)' : 'transparent'} color={n <= draft.rating ? 'var(--secondary)' : 'var(--border-strong)'} />
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                maxLength={2000}
                placeholder="Was the item as described? How was meeting up?"
                value={draft.text}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              />
              <div className="review-form-actions">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setWriting(false)}>Cancel</button>
                <button className="btn btn-primary btn-sm" type="submit" disabled={submitting || !draft.text.trim()}>
                  {submitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />} Post review
                </button>
              </div>
            </form>
          )}

          {reviewsLoading ? (
            <Skeleton h={96} r={16} />
          ) : reviews.items.length === 0 ? (
            <div className="rv-empty">
              <MessageSquareText size={22} aria-hidden />
              <p>No reviews yet. Buyers can rate this seller once their order is delivered.</p>
            </div>
          ) : (
            <ul className="rv-list">
              {reviews.items.map((r) => (
                <li key={r._id} className="rv-item">
                  <div className="rv-head">
                    <Avatar src={r.reviewer?.avatar} name={r.reviewer?.name || 'Buyer'} size={36} />
                    <div>
                      <strong>{r.reviewer?.name || 'sBay buyer'}</strong>
                      <span className="muted small">{fmtDate(r.updatedAt || r.createdAt)}</span>
                    </div>
                    <Stars value={r.rating} size={13} />
                  </div>
                  <p>{r.text}</p>
                  <span className="rv-verified"><Check size={12} /> Verified purchase</span>
                </li>
              ))}
            </ul>
          )}

          {reviews.items.length < reviews.total && (
            <button className="btn btn-ghost btn-block" onClick={loadMore} disabled={moreLoading}>
              {moreLoading ? <Loader2 size={16} className="spin" /> : null} Show more reviews
            </button>
          )}
        </aside>
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

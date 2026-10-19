import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft, Star, MapPin, Send, BadgeCheck, Clock, Loader2,
} from 'lucide-react';
import ProductCard, { ProductGrid } from '../components/ProductCard';
import { sbay } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { Skeleton, SkeletonGrid } from '../components/Skeleton';
import Avatar from '../components/Avatar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import './pages.css';
import './SellerProfile.css';

export default function SellerProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [seller, setSeller] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState('listings');
  const [reviewsState, setReviewsState] = useState({ items: [], total: 0, rating: 0 });
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsError, setReviewsError] = useState('');
  const [draft, setDraft] = useState({ rating: 5, text: '' });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoadError('');
    sbay.getSeller(id)
      .then((data) => {
        if (!alive) return;
        setSeller(data);
      })
      .catch((e) => {
        if (!alive) return;
        setSeller(null);
        // Previously the skeleton spun forever on any error.
        setLoadError(e.status === 404 ? 'This seller could not be found.' : (e.message || 'Could not load this seller.'));
      });
    return () => { alive = false; };
  }, [id]);

  useEffect(() => {
    let alive = true;
    if (tab !== 'reviews') return undefined;

    setReviewsLoading(true);
    setReviewsError('');
    sbay.getSellerReviews(id)
      .then((data) => {
        if (!alive) return;
        setReviewsState({
          items: Array.isArray(data.items) ? data.items : [],
          total: Number(data.total) || 0,
          rating: Number(data.rating) || 0,
        });
        if (data.seller) {
          setSeller((cur) => (cur ? {
            ...cur,
            sellerProfile: {
              ...(cur.sellerProfile || {}),
              ...(data.seller.sellerProfile || {}),
              rating: Number(data.rating) || Number(data.seller.sellerProfile?.rating) || 0,
              reviewCount: Number(data.total) || Number(data.seller.sellerProfile?.reviewCount) || 0,
            },
          } : cur));
        }
      })
      .catch((err) => {
        if (!alive) return;
        setReviewsError(err.message || 'Unable to load reviews.');
        setReviewsState({ items: [], total: 0, rating: 0 });
      })
      .finally(() => {
        if (alive) setReviewsLoading(false);
      });

    return () => { alive = false; };
  }, [id, tab]);

  const ratingSummary = useMemo(() => {
    const count = reviewsState.total || seller?.sellerProfile?.reviewCount || 0;
    const rating = reviewsState.rating || seller?.sellerProfile?.rating || 0;
    return { count, rating };
  }, [reviewsState.total, reviewsState.rating, seller?.sellerProfile]);

  const submitReview = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/login?next=' + encodeURIComponent(`/seller/${id}`));
      return;
    }
    if (!draft.text.trim()) return;

    setSubmitting(true);
    setReviewsError('');
    try {
      const result = await sbay.submitReview(id, {
        rating: draft.rating,
        text: draft.text.trim(),
      });

      setReviewsState((cur) => ({
        ...cur,
        items: result.review
          ? [result.review, ...cur.items.filter((r) => r._id !== result.review._id)]
          : cur.items,
        total: Number(result.reviewCount) || cur.total,
        rating: Number(result.rating) || cur.rating,
      }));

      setSeller((cur) => (cur ? {
        ...cur,
        sellerProfile: {
          ...(cur.sellerProfile || {}),
          rating: Number(result.rating) || cur.sellerProfile?.rating || 0,
          reviewCount: Number(result.reviewCount) || cur.sellerProfile?.reviewCount || 0,
        },
      } : cur));

      setDraft({ rating: 5, text: '' });
      setTab('reviews');
    } catch (err) {
      setReviewsError(err.message || 'Could not post review.');
    } finally {
      setSubmitting(false);
    }
  };

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
        <div className="sp-hero" style={{ paddingBottom: 40 }}>
          <Skeleton w={92} h={92} r="50%" style={{ margin: '40px auto 12px', display: 'block' }} />
          <Skeleton w={140} h={20} style={{ margin: '0 auto', display: 'block' }} />
        </div>
        <main className="page-main">
          <SkeletonGrid count={6} />
        </main>
      </div>
    );
  }

  const reviewCount = ratingSummary.count || 0;
  const reviewRating = ratingSummary.rating || 0;

  return (
    <div className="page sp">
      <div className="sp-hero">
        <button className="round-btn" onClick={() => navigate(-1)}><ArrowLeft size={20} /></button>
        <Avatar src={seller.avatar} name={seller.name} size={80} className="sp-avatar" />
        <h1 className="sp-name">
          {seller.name}
          {seller.verified && <BadgeCheck size={18} color="#0A7E3E" aria-label="Verified" />}
        </h1>
        <div className="sp-meta">
          <span><Star size={13} fill="#F5A623" color="#F5A623" /> {reviewRating.toFixed(1)} ({reviewCount})</span>
          <span><MapPin size={13} /> {seller.sellerProfile?.location || seller.location || 'Location not set'}</span>
        </div>
        <p className="sp-bio">{seller.sellerProfile?.bio || seller.bio || 'No store bio yet.'}</p>
        <div className="sp-badges">
          {seller.verified ? (
            <span className="badge-soft is-verified"><BadgeCheck size={12} /> Verified seller</span>
          ) : (
            <span className="badge-soft is-pending"><Clock size={12} /> Pending review</span>
          )}
          {seller.createdAt && (
            <span className="badge-soft">
              <Clock size={12} /> On sBay since {new Date(seller.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      <div className="sp-tabs">
        <button className={`sp-tab ${tab === 'listings' ? 'active' : ''}`} onClick={() => setTab('listings')}>
          Listings ({seller.listings.length})
        </button>
        <button className={`sp-tab ${tab === 'reviews' ? 'active' : ''}`} onClick={() => setTab('reviews')}>
          Reviews ({reviewCount})
        </button>
      </div>

      <main className="page-main">
        {tab === 'listings' ? (
          seller.listings.length === 0 ? (
            <div className="empty">
              <h3>No active listings</h3>
              <p>This seller doesn't have anything for sale right now.</p>
            </div>
          ) : (
            <ProductGrid>
              {seller.listings.map((p) => (
                <ProductCard key={p.id} p={{ ...p, sellerName: undefined }} />
              ))}
            </ProductGrid>
          )
        ) : (
          <div className="sp-reviews">
            <form className="card review-form" onSubmit={submitReview}>
              <h4>Leave a review</h4>
              <p className="muted small" style={{ margin: 0 }}>
                Reviews are open to buyers who have received an order from this seller.
              </p>
              <div className="rating-pick">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setDraft((d) => ({ ...d, rating: n }))}
                    aria-label={`${n} stars`}
                  >
                    <Star size={20} fill={n <= draft.rating ? '#F5A623' : 'transparent'} color={n <= draft.rating ? '#F5A623' : '#C9D4BD'} />
                  </button>
                ))}
              </div>
              <textarea
                rows={3}
                placeholder={user ? 'Share your experience with this seller...' : 'Sign in to leave a review'}
                value={draft.text}
                onChange={(e) => setDraft((d) => ({ ...d, text: e.target.value }))}
              />
              {reviewsError && <p className="auth-error" style={{ marginTop: 0 }}>{reviewsError}</p>}
              <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }} disabled={submitting}>
                {submitting ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                {user ? 'Post Review' : 'Sign in to post'}
              </button>
            </form>

            {reviewsLoading ? (
              <div className="card" style={{ display: 'grid', placeItems: 'center', padding: 24 }}>
                <Loader2 size={18} className="spin" />
              </div>
            ) : reviewsState.items.length > 0 ? (
              reviewsState.items.map((r) => {
                const reviewerName = r.reviewer?.name || 'Verified buyer';
                const time = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : 'Recently';
                return (
                  <article key={r._id} className="card review-card">
                    <div className="review-head">
                      <strong>{reviewerName}</strong>
                      <span className="muted">{time}</span>
                    </div>
                    <div className="review-stars">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <Star key={i} size={14} fill={i < r.rating ? '#F5A623' : '#E5E4E7'} color={i < r.rating ? '#F5A623' : '#E5E4E7'} />
                      ))}
                    </div>
                    <p style={{ marginTop: 6 }}>{r.text}</p>
                  </article>
                );
              })
            ) : (
              <div className="card" style={{ padding: 18 }}>
                <p className="muted" style={{ margin: 0 }}>
                  No reviews yet. Be the first to rate this seller after a completed order.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

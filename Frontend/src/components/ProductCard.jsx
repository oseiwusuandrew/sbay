import { memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, MapPin, BadgeCheck } from 'lucide-react';
import { useWishlist } from '../store/WishlistContext';
import { ghs } from '../utils/money';
import './ProductCard.css';

/**
 * The one product tile used across the marketplace (home, search,
 * categories, trending, seller pages, wishlist). Pages used to each ship
 * their own markup, so prices, hearts and badges behaved differently
 * depending on where you were.
 *
 * Props: p (adapted product), rank (optional number badge),
 *        variant: 'grid' | 'rail' (fixed width for horizontal scrollers).
 */
function ProductCard({ p, rank, variant = 'grid' }) {
  const navigate = useNavigate();
  const { has, toggle } = useWishlist();
  const saved = has(p.id);

  const compareAt = Number(p.discountPrice) > Number(p.price) ? Number(p.discountPrice) : null;
  const savePct = compareAt ? Math.round((1 - p.price / compareAt) * 100) : 0;
  const soldOut = p.status === 'sold_out' || (p.stock !== undefined && p.stock <= 0 && p.status !== 'active');
  const where = [p.school, p.city].filter(Boolean).join(' · ');
  const href = `/product/${p.id}`;

  const open = () => navigate(href);
  const onKey = (e) => { if (e.key === 'Enter') open(); };

  return (
    <article
      className={`pcard pcard--${variant} ${soldOut ? 'is-soldout' : ''}`}
      onClick={open}
      onKeyDown={onKey}
      tabIndex={0}
      role="link"
      aria-label={`${p.title}, ${ghs(p.price)}`}
    >
      <div className="pcard-media">
        <img src={p.image} alt="" loading="lazy" decoding="async" />
        {rank != null && <span className="pcard-rank">#{rank}</span>}
        {soldOut ? (
          <span className="pcard-flag pcard-flag--muted">Sold out</span>
        ) : savePct >= 5 ? (
          <span className="pcard-flag">-{savePct}%</span>
        ) : null}
        <button
          type="button"
          className={`pcard-heart ${saved ? 'is-saved' : ''}`}
          aria-pressed={saved}
          aria-label={saved ? 'Remove from wishlist' : 'Save to wishlist'}
          onClick={(e) => { e.stopPropagation(); toggle(p); }}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <Heart size={16} fill={saved ? 'currentColor' : 'none'} />
        </button>
      </div>

      <div className="pcard-body">
        <h3 className="pcard-title">{p.title}</h3>
        <div className="pcard-price">
          <strong>{ghs(p.price)}</strong>
          {compareAt && <s>{ghs(compareAt)}</s>}
        </div>
        <div className="pcard-meta">
          {p.condition && <span className="pcard-cond">{p.condition}</span>}
          {where && (
            <span className="pcard-where"><MapPin size={12} aria-hidden /> {where}</span>
          )}
        </div>
        {p.sellerName && (
          <div className="pcard-seller">
            <span>{p.sellerName}</span>
            {p.sellerVerified && <BadgeCheck size={13} className="pcard-verified" aria-label="Verified seller" />}
          </div>
        )}
      </div>
    </article>
  );
}

export default memo(ProductCard);

/** Responsive grid wrapper so every page lays tiles out the same way. */
export function ProductGrid({ children, dense = false }) {
  return <div className={`pgrid ${dense ? 'pgrid--dense' : ''}`}>{children}</div>;
}

/** Horizontally scrolling rail (trending, similar items). */
export function ProductRail({ children, label }) {
  return <div className="prail" role="list" aria-label={label}>{children}</div>;
}

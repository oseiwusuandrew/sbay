import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  MapPin, ChevronDown, Search as SearchIcon, ShieldCheck, BadgeCheck, Smartphone, Lock,
} from 'lucide-react';
import { sbay } from '../api/client';
import { ghs } from '../utils/money';
import './HomeHero.css';

/**
 * Home hero: brand-green band with the campus switcher, search and
 * categories on the left, and a collage of real listings (local if a
 * campus is chosen) on the right. Stats come from the live catalogue.
 */
export default function HomeHero({
  campus, firstName, categories, picks, query, setQuery, onSearch, onPickCampus,
}) {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    sbay.getCatalogMeta()
      .then((m) => setStats({
        listings: m.total || 0,
        campuses: (m.schools || []).filter((s) => s.id !== 'others').length,
        categories: (m.categories || []).length,
      }))
      .catch(() => setStats(null));
  }, []);

  const scope = campus && campus.id !== 'others' ? `&school=${encodeURIComponent(campus.label)}` : '';
  // Unique listings with photos; three cards keep every price tag visible.
  const collage = picks
    .filter((p, i, arr) => p.image && arr.findIndex((x) => x.id === p.id) === i)
    .slice(0, 3);

  return (
    <section className={`hh ${campus ? 'hh--local' : ''}`}>
      <div className="hh-inner">
        <div className="hh-copy">
          <button className="hh-loc" onClick={onPickCampus} aria-haspopup="dialog">
            <MapPin size={15} aria-hidden />
            <span>{campus ? campus.label : 'All campuses'}</span>
            {campus?.city && <em>{campus.city}</em>}
            <ChevronDown size={15} aria-hidden />
          </button>

          {campus ? (
            <h1>
              {firstName ? `${firstName}, here's` : "Here's"} what's on sale at <span>{campus.label}</span>
            </h1>
          ) : (
            <h1>Buy and sell on campus, <span>without the risk.</span></h1>
          )}
          <p className="hh-sub">
            {campus
              ? 'Listings from students on your campus, so you can meet up and collect the same day.'
              : 'Your money is held safely until you confirm the item has reached you. Pick your campus to see what you can collect nearby.'}
          </p>

          <form className="hh-search" onSubmit={onSearch} role="search">
            <SearchIcon size={20} aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={campus ? `Search listings at ${campus.label}` : 'What are you looking for?'}
              aria-label="Search sBay"
            />
            <button type="submit" className="btn btn-secondary">Search</button>
          </form>

          {categories.length > 0 && (
            <div className="hh-cats" aria-label="Categories">
              {categories.map((c) => (
                <Link key={c.id} className="hh-chip" to={`/search?category=${encodeURIComponent(c.label)}${scope}`}>
                  {c.label}{c.count ? <span>{c.count}</span> : null}
                </Link>
              ))}
            </div>
          )}

          <ul className="hh-trust" aria-label="Why sBay">
            <li><ShieldCheck size={16} aria-hidden /> Escrow on every order</li>
            <li><BadgeCheck size={16} aria-hidden /> Verified student sellers</li>
            <li><Smartphone size={16} aria-hidden /> MoMo or card</li>
          </ul>
        </div>

        <div className="hh-visual" aria-hidden={collage.length === 0}>
          {collage.length > 0 && (
            <div className={`hh-collage n${collage.length}`}>
              {collage.map((p, i) => (
                <Link key={p.id} to={`/product/${p.id}`} className={`hh-card c${i}`} tabIndex={-1}>
                  <img src={p.image} alt={p.title} />
                  <span className="hh-title">{p.title}</span>
                  <span className="hh-price">{ghs(p.price)}</span>
                </Link>
              ))}
              <div className="hh-badge">
                <span className="hh-badge-ic"><Lock size={16} /></span>
                <div>
                  <strong>Payment held in escrow</strong>
                  <small>Released when you confirm delivery</small>
                </div>
              </div>
            </div>
          )}
          {stats && stats.listings > 0 && (
            <dl className="hh-stats">
              <div><dt>Live listings</dt><dd>{stats.listings.toLocaleString()}</dd></div>
              <div><dt>Campuses</dt><dd>{stats.campuses}</dd></div>
              <div><dt>Categories</dt><dd>{stats.categories}</dd></div>
            </dl>
          )}
        </div>
      </div>
    </section>
  );
}

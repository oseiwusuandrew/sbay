import { Link } from 'react-router-dom';
import {
  MapPin, ChevronDown, Search as SearchIcon, BookOpen, Laptop, Smartphone, Shirt,
  Lamp, Tag, ShieldCheck,
} from 'lucide-react';
import './HomeHero.css';

// Icon per category name; anything unknown falls back to a tag.
const CATEGORY_ICONS = [
  [/book|text/i, BookOpen],
  [/phone/i, Smartphone],
  [/electr|laptop|computer|gadget/i, Laptop],
  [/fashion|cloth|shoe|wear/i, Shirt],
  [/hall|home|room|furniture|essential/i, Lamp],
];
const iconFor = (label) => (CATEGORY_ICONS.find(([re]) => re.test(label)) || [null, Tag])[1];

/**
 * Home header: a plain brand strip with the campus selector, search and
 * category shortcuts. Everything in it is a working control — no
 * decorative cards or numbers.
 */
export default function HomeHero({
  campus, categories, query, setQuery, onSearch, onPickCampus,
}) {
  const scope = campus && campus.id !== 'others' ? `&school=${encodeURIComponent(campus.label)}` : '';

  return (
    <section className="hh">
      <div className="hh-inner">
        <div className="hh-top">
          <button className="hh-loc" onClick={onPickCampus} aria-haspopup="dialog">
            <MapPin size={16} aria-hidden />
            <span>{campus ? campus.label : 'Choose your campus'}</span>
            <ChevronDown size={16} aria-hidden />
          </button>
        </div>

        <h1>{campus ? `What's for sale at ${campus.label}` : 'Buy and sell with students near you'}</h1>

        <form className="hh-search" onSubmit={onSearch} role="search">
          <SearchIcon size={20} aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={campus ? `Search ${campus.label}` : 'Search textbooks, phones, fashion…'}
            aria-label="Search sBay"
          />
          <button type="submit" className="btn btn-primary">Search</button>
        </form>

        <p className="hh-note">
          <ShieldCheck size={15} aria-hidden />
          The seller only gets paid after you confirm you've received your item.{' '}
          <a href="#how">How it works</a>
        </p>
      </div>

      {categories.length > 0 && (
        <nav className="hh-cats" aria-label="Shop by category">
          <div className="hh-cats-inner">
            {categories.map((c) => {
              const Icon = iconFor(c.label);
              return (
                <Link key={c.id} className="hh-cat" to={`/search?category=${encodeURIComponent(c.label)}${scope}`}>
                  <span className="hh-cat-ic"><Icon size={20} aria-hidden /></span>
                  <span className="hh-cat-name">{c.label}</span>
                  {c.count > 0 && <span className="hh-cat-n">{c.count}</span>}
                </Link>
              );
            })}
            <Link className="hh-cat" to="/categories">
              <span className="hh-cat-ic"><Tag size={20} aria-hidden /></span>
              <span className="hh-cat-name">All categories</span>
            </Link>
          </div>
        </nav>
      )}
    </section>
  );
}

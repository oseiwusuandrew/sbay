import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search as SearchIcon, ArrowLeft, X, PackageSearch, MapPin } from 'lucide-react';
import { sbay } from '../api/client';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import ProductCard, { ProductGrid } from '../components/ProductCard';
import { SkeletonGrid } from '../components/Skeleton';
import './pages.css';
import './Search.css';

const SORTS = [
  { id: 'recent', label: 'Newest' },
  { id: 'popular', label: 'Most viewed' },
  { id: 'price_asc', label: 'Price: low to high' },
  { id: 'price_desc', label: 'Price: high to low' },
];

export default function SearchPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const school = params.get('school') || '';
  const sort = params.get('sort') || 'recent';

  const [draft, setDraft] = useState(q);
  const [categories, setCategories] = useState([]);
  const [results, setResults] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const debounce = useRef(null);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    Object.entries(patch).forEach(([k, v]) => (v ? next.set(k, v) : next.delete(k)));
    setParams(next, { replace: true });
  };

  // Keep the box in sync when the URL changes (back/forward, header search).
  useEffect(() => { setDraft(q); }, [q]);

  useEffect(() => {
    sbay.getCategories()
      .then((cats) => setCategories(cats.filter((c) => c.id !== 'all')))
      .catch(() => setCategories([]));
  }, []);

  // Query the API once typing pauses — it used to fire on every keystroke
  // (and could trip the rate limiter) and never recovered from errors.
  const onType = (value) => {
    setDraft(value);
    clearTimeout(debounce.current);
    debounce.current = setTimeout(() => update({ q: value.trim() }), 300);
  };
  useEffect(() => () => clearTimeout(debounce.current), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const req = { sort, limit: 60 };
    if (q) req.q = q;
    if (category) req.category = category;
    if (school) req.school = school;
    sbay.searchPage(req)
      .then(({ items, total: t }) => { if (active) { setResults(items); setTotal(t); } })
      .catch((e) => { if (active) { setResults([]); setError(e.message || 'Search failed.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [q, category, school, sort]);

  const heading = q
    ? `Results for “${q}”`
    : category || (school ? `Listings at ${school}` : 'All listings');

  return (
    <div className="page">
      <header className="search-top">
        <button className="round-btn" onClick={() => navigate(-1)} aria-label="Back">
          <ArrowLeft size={20} />
        </button>
        <form
          className="search-input-wrap"
          role="search"
          onSubmit={(e) => { e.preventDefault(); clearTimeout(debounce.current); update({ q: draft.trim() }); }}
        >
          <SearchIcon size={18} className="leading" aria-hidden />
          <input
            autoFocus={!q && !category}
            type="search"
            placeholder="Search textbooks, phones, fashion…"
            value={draft}
            onChange={(e) => onType(e.target.value)}
            aria-label="Search"
          />
          {draft && (
            <button type="button" className="clear" onClick={() => onType('')} aria-label="Clear search">
              <X size={16} />
            </button>
          )}
        </form>
      </header>

      {categories.length > 0 && (
        <div className="filter-row" role="toolbar" aria-label="Filter by category">
          <button className={`chip ${!category ? 'active' : ''}`} onClick={() => update({ category: '' })}>All</button>
          {categories.map((c) => (
            <button
              key={c.id}
              className={`chip ${category.toLowerCase() === c.label.toLowerCase() ? 'active' : ''}`}
              onClick={() => update({ category: c.label })}
            >
              {c.label}
            </button>
          ))}
        </div>
      )}

      <main className="page-main">
        <div className="search-head">
          <div>
            <h1 className="page-h1">{heading}</h1>
            <div className="search-meta">
              {!loading && !error && <span className="muted small">{total} item{total === 1 ? '' : 's'}</span>}
              {school && (
                <button className="filter-tag" onClick={() => update({ school: '' })} aria-label={`Remove campus filter ${school}`}>
                  <MapPin size={13} aria-hidden /> {school} <X size={13} aria-hidden />
                </button>
              )}
            </div>
          </div>
          <label className="sort-select">
            <span className="sr-only">Sort by</span>
            <select value={sort} onChange={(e) => update({ sort: e.target.value === 'recent' ? '' : e.target.value })}>
              {SORTS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
        </div>

        {error && <div className="notice notice--error" role="alert">{error}</div>}

        {loading ? (
          <SkeletonGrid count={10} />
        ) : results.length === 0 && !error ? (
          <div className="empty">
            <span className="empty-ic"><PackageSearch size={26} /></span>
            <h3>{q ? `No results for “${q}”` : 'Nothing here yet'}</h3>
            <p>{q ? 'Check the spelling, try a shorter word, or browse by category.' : 'Try another category.'}</p>
            {(q || category || school) && (
              <button className="btn btn-ghost" onClick={() => { setDraft(''); update({ q: '', category: '', school: '' }); }}>
                Clear search
              </button>
            )}
          </div>
        ) : (
          <ProductGrid>
            {results.map((p) => <ProductCard key={p.id} p={p} />)}
          </ProductGrid>
        )}
      </main>
      <Footer />
      <BottomNav />
    </div>
  );
}

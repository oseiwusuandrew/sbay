import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Search, X, ShoppingBag } from 'lucide-react';
import BottomNav from '../components/BottomNav';
import ProductCard, { ProductGrid } from '../components/ProductCard';
import Footer from '../components/Footer';
import { SkeletonGrid } from '../components/Skeleton';
import { Notice } from '../components/Feedback';
import { sbay } from '../api/client';
import './pages.css';
import './Categories.css';

/**
 * Browse by campus and category.
 *
 * Two rows of chips — campus, then category — filter one product grid.
 * The choice lives in the URL (/category/:campus?c=category&loc=location)
 * so the back button, refresh and shared links all keep it.
 */
export default function Categories() {
  const navigate = useNavigate();
  const { catId: schoolId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const cat = params.get('c') || '';
  const loc = params.get('loc') || '';

  const [meta, setMeta] = useState(null);       // { categories, schools }
  const [metaFailed, setMetaFailed] = useState(false);
  const [result, setResult] = useState({ key: null, items: [], failed: false });
  const [query, setQuery] = useState('');

  useEffect(() => {
    let alive = true;
    Promise.all([sbay.getCatalogMeta(), sbay.getSchoolTree()])
      .then(([m, schools]) => { if (alive) setMeta({ categories: m.categories || [], schools }); })
      .catch(() => { if (alive) { setMetaFailed(true); setMeta({ categories: [], schools: [] }); } });
    return () => { alive = false; };
  }, []);

  const school = meta?.schools.find((s) => s.id === schoolId) || null;
  const location = school?.locations?.find((l) => l.id === loc) || null;
  const categories = location?.categories || school?.categories || meta?.categories || [];
  const activeCat = categories.find((c) => c.id === cat) || null;

  // Products for the current campus / location / category.
  const key = `${schoolId}|${loc}|${cat}`;
  useEffect(() => {
    let alive = true;
    const fetcher = schoolId || loc
      ? sbay.getProductsByScope({ schoolId: schoolId || null, location: loc || null, categoryId: cat || null })
      : cat
        ? sbay.getProductsByCategory(cat)
        : sbay.getAllProducts({ limit: 60 });
    fetcher
      .then((items) => { if (alive) setResult({ key, items, failed: false }); })
      .catch(() => { if (alive) setResult({ key, items: [], failed: true }); });
    return () => { alive = false; };
  }, [key, schoolId, loc, cat]);

  const loading = result.key !== key;

  const pickSchool = (id) => {
    setQuery('');
    navigate(id ? `/category/${encodeURIComponent(id)}` : '/categories');
  };
  const setFilter = (name, value) => {
    setQuery('');
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    if (name === 'loc') next.delete('c'); // categories differ per location
    setParams(next);
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return result.items;
    return result.items.filter((p) =>
      p.title.toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q));
  }, [result.items, query]);

  // With no category picked, group by category so the page reads as a catalogue.
  const groups = useMemo(() => {
    const map = new Map();
    for (const p of shown) {
      const label = p.category || 'Other';
      if (!map.has(label)) map.set(label, []);
      map.get(label).push(p);
    }
    return [...map.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [shown]);

  const catIdFor = (label) =>
    categories.find((c) => c.label === label)?.id || label.toLowerCase();

  const title = activeCat?.label || location?.label || school?.label || 'All categories';
  const where = [location?.label, school?.label].filter(Boolean).join(', ');
  const flat = !!activeCat || !!query.trim();

  return (
    <div className="page cat-page">
      <header className="cat-head">
        <div className="cat-head-inner">
          <div className="cat-title-row">
            <div>
              <h1 className="cat-title">{title}</h1>
              <p className="cat-sub">
                {loading ? 'Loading…' : `${shown.length} item${shown.length === 1 ? '' : 's'}`}
                {activeCat && where && ` · ${where}`}
              </p>
            </div>
            <label className="cat-search">
              <Search size={16} aria-hidden="true" />
              <input
                type="search"
                placeholder={`Search ${title.toLowerCase()}`}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                aria-label="Search these listings"
              />
              {query && (
                <button type="button" onClick={() => setQuery('')} aria-label="Clear search">
                  <X size={15} />
                </button>
              )}
            </label>
          </div>

          {meta && meta.schools.length > 0 && (
            <div className="cat-chips" role="group" aria-label="Campus">
              <button className={`chip ${!schoolId ? 'active' : ''}`} onClick={() => pickSchool('')}>
                All campuses
              </button>
              {meta.schools.map((s) => (
                <button
                  key={s.id}
                  className={`chip ${schoolId === s.id ? 'active' : ''}`}
                  onClick={() => pickSchool(s.id)}
                  aria-pressed={schoolId === s.id}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {school?.locations?.length > 0 && (
            <div className="cat-chips" role="group" aria-label="Location">
              <button className={`chip chip-soft ${!loc ? 'active' : ''}`} onClick={() => setFilter('loc', '')}>
                All locations
              </button>
              {school.locations.map((l) => (
                <button
                  key={l.id}
                  className={`chip chip-soft ${loc === l.id ? 'active' : ''}`}
                  onClick={() => setFilter('loc', l.id)}
                  aria-pressed={loc === l.id}
                >
                  {l.label}
                </button>
              ))}
            </div>
          )}

          {categories.length > 0 && (
            <div className="cat-chips" role="group" aria-label="Category">
              <button className={`chip chip-soft ${!cat ? 'active' : ''}`} onClick={() => setFilter('c', '')}>
                All
              </button>
              {categories.map((c) => (
                <button
                  key={c.id}
                  className={`chip chip-soft ${cat === c.id ? 'active' : ''}`}
                  onClick={() => setFilter('c', c.id)}
                  aria-pressed={cat === c.id}
                >
                  {c.label}
                  <span className="chip-count">{c.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      <main className="page-main cat-main">
        {metaFailed && (
          <Notice tone="warning">Campuses and categories couldn't be loaded, so only the product list is shown.</Notice>
        )}

        {loading ? (
          <SkeletonGrid count={8} />
        ) : result.failed ? (
          <Notice
            tone="error"
            action={<button className="link-btn" onClick={() => window.location.reload()}>Retry</button>}
          >
            We couldn't load these listings. Please try again.
          </Notice>
        ) : shown.length === 0 ? (
          <div className="empty">
            <span className="empty-ic"><ShoppingBag size={26} /></span>
            <h3>{query ? `No results for "${query}"` : 'Nothing here yet'}</h3>
            <p>
              {query
                ? 'Try a different word, or clear the search.'
                : `No one has listed ${activeCat ? activeCat.label.toLowerCase() : 'anything'}${school ? ` at ${school.label}` : ''} yet.`}
            </p>
            {query
              ? <button className="btn btn-ghost" onClick={() => setQuery('')}>Clear search</button>
              : (cat || schoolId) && <button className="btn btn-ghost" onClick={() => pickSchool('')}>Browse everything</button>}
          </div>
        ) : flat ? (
          <ProductGrid>
            {shown.map((p) => <ProductCard key={p.id} p={p} />)}
          </ProductGrid>
        ) : (
          groups.map(([label, items]) => (
            <section key={label} className="cat-section">
              <div className="cat-section-hd">
                <h2>{label}</h2>
                {items.length > 8 ? (
                  <button className="view-all" onClick={() => setFilter('c', catIdFor(label))}>
                    See all {items.length}
                  </button>
                ) : (
                  <span className="cat-section-count">{items.length}</span>
                )}
              </div>
              <ProductGrid>
                {items.slice(0, 8).map((p) => <ProductCard key={p.id} p={p} />)}
              </ProductGrid>
            </section>
          ))
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}

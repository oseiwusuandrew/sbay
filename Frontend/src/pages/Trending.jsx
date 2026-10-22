import { useEffect, useMemo, useState } from 'react';
import { TrendingUp, Flame, Globe, MapPin } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import CampusBanner from '../components/CampusBanner';
import ProductCard, { ProductGrid } from '../components/ProductCard';
import { SkeletonGrid } from '../components/Skeleton';
import { sbay } from '../api/client';
import { useLocation as useCampus } from '../store/LocationContext';
import { Notice } from '../components/Feedback';
import './pages.css';

export default function Trending() {
  const { campus } = useCampus();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [scope, setScope] = useState('local'); // 'local' | 'all'

  useEffect(() => {
    let active = true;
    // Ranked by views — previously this page mixed "recently added"
    // items into the trending list.
    sbay.getAllProducts({ sort: 'popular', limit: 48 })
      .then((rows) => { if (active) setItems(rows); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const localItems = useMemo(() => {
    if (!campus) return [];
    const school = campus.label.toLowerCase();
    const city = (campus.city || '').toLowerCase();
    return items.filter((p) => {
      const ps = (p.school || '').toLowerCase();
      const pc = (p.city || '').toLowerCase();
      return (ps && (ps.includes(school) || school.includes(ps))) || (city && pc && (pc.includes(city) || city.includes(pc)));
    });
  }, [campus, items]);

  // Fall back to everything when nothing local is trending yet.
  const showLocal = campus && scope === 'local' && localItems.length > 0;
  const displayed = showLocal ? localItems : items;

  return (
    <div className="page">
      <TopBar showBack title="Trending" />
      <CampusBanner />

      <main className="page-main">
        <div className="trend-banner">
          <TrendingUp size={28} aria-hidden />
          <div style={{ flex: 1 }}>
            <h1>What's hot on campus</h1>
            <p>{showLocal ? `Most viewed near ${campus.label}` : 'Most viewed listings across all campuses'}</p>
          </div>
          {campus && localItems.length > 0 && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setScope((s) => (s === 'local' ? 'all' : 'local'))}
            >
              {scope === 'local' ? <><Globe size={14} /> All campuses</> : <><MapPin size={14} /> Near {campus.label}</>}
            </button>
          )}
        </div>

        {failed && <Notice tone="error">Couldn't load trending items. Please try again.</Notice>}

        {loading ? (
          <SkeletonGrid count={10} />
        ) : displayed.length === 0 ? (
          <div className="empty">
            <span className="empty-ic"><Flame size={26} /></span>
            <h3>Nothing trending yet</h3>
            <p>As students view and buy listings, the hottest items will show up here.</p>
          </div>
        ) : (
          <ProductGrid>
            {displayed.map((p, i) => <ProductCard key={p.id} p={p} rank={i < 10 ? i + 1 : undefined} />)}
          </ProductGrid>
        )}
      </main>

      <Footer />
      <BottomNav />
    </div>
  );
}

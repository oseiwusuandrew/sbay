import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, BadgeCheck, Package, Star, Wallet, MessageCircle, PackageCheck, Plus,
  Navigation, Loader2, GraduationCap,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import HomeHero from '../components/HomeHero';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import CampusPicker from '../components/CampusPicker';
import ProductCard, { ProductGrid, ProductRail } from '../components/ProductCard';
import Avatar from '../components/Avatar';
import { sbay } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { useLocation as useCampus } from '../store/LocationContext';
import { SkeletonGrid, Skeleton } from '../components/Skeleton';
import { Notice } from '../components/Feedback';
import './pages.css';
import './Home.css';

const sameSchool = (p, campus) => {
  if (!campus) return false;
  const a = (p.school || '').toLowerCase();
  const b = campus.label.toLowerCase();
  return !!a && (a === b || a.includes(b) || b.includes(a));
};

/** Unique sellers from a set of listings, best rated first. */
function sellersFrom(products, limit = 8) {
  const map = new Map();
  const seen = new Set(); // the same listing can be in both "new" and "popular"
  for (const p of products) {
    if (!p.sellerId || !p.sellerName || seen.has(p.id)) continue;
    seen.add(p.id);
    const cur = map.get(p.sellerId) || {
      id: p.sellerId, name: p.sellerName, avatar: p.sellerAvatar, verified: p.sellerVerified,
      rating: p.sellerRating, reviews: p.sellerReviews, location: p.sellerLocation, listings: 0,
    };
    cur.listings += 1;
    map.set(p.sellerId, cur);
  }
  return [...map.values()]
    .sort((a, b) => (b.verified - a.verified) || (b.rating - a.rating) || (b.listings - a.listings))
    .slice(0, limit);
}

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campus, schools, loading: schoolsLoading, locStatus, autoDetect } = useCampus();
  const [pickerOpen, setPickerOpen] = useState(false);
  const closePicker = useCallback(() => setPickerOpen(false), []);
  const [query, setQuery] = useState('');

  // Nationwide feed (always loaded — it's cached and backs the
  // "other campuses" and no-campus sections).
  const [feed, setFeed] = useState({ trending: [], recent: [], sellers: [] });
  const [feedLoading, setFeedLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Campus-scoped feed, queried from the API rather than filtered out of
  // the 24 nationwide items (which missed most of a campus's listings).
  const [local, setLocal] = useState({ recent: [], popular: [] });
  const [localLoading, setLocalLoading] = useState(false);

  useEffect(() => {
    let active = true;
    sbay.getHomeFeed()
      .then((f) => { if (active) setFeed(f); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setFeedLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!campus) { setLocal({ recent: [], popular: [] }); return undefined; }
    let active = true;
    setLocalLoading(true);
    const scoped = campus.id === 'others'
      ? sbay.getProductsByScope({ schoolId: 'others' }).then((rows) => [rows, [...rows].sort((a, b) => (b.views || 0) - (a.views || 0))])
      : Promise.all([
        sbay.getAllProducts({ school: campus.label, sort: 'recent', limit: 15 }),
        sbay.getAllProducts({ school: campus.label, sort: 'popular', limit: 12 }),
      ]);
    scoped
      .then(([recent, popular]) => { if (active) setLocal({ recent, popular }); })
      .catch(() => { if (active) setLocal({ recent: [], popular: [] }); })
      .finally(() => { if (active) setLocalLoading(false); });
    return () => { active = false; };
  }, [campus]);

  const campusSchool = useMemo(
    () => (campus ? schools.find((s) => s.id === campus.id) || campus : null),
    [campus, schools],
  );

  // Categories: this campus's own categories when one is set, else global.
  const [globalCats, setGlobalCats] = useState([]);
  useEffect(() => {
    sbay.getCategories()
      .then((cats) => setGlobalCats(cats.filter((c) => c.id !== 'all')))
      .catch(() => setGlobalCats([]));
  }, []);
  const categories = (campusSchool?.categories?.length ? campusSchool.categories : globalCats).slice(0, 10);

  const otherCampuses = useMemo(
    () => feed.recent.filter((p) => !sameSchool(p, campus)).slice(0, 10),
    [feed.recent, campus],
  );
  const localSellers = useMemo(() => sellersFrom([...local.recent, ...local.popular]), [local]);
  const nationalSellers = feed.sellers.filter((s) => s.verified);
  const topCampuses = useMemo(
    () => [...schools].filter((s) => s.id !== 'others').sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 8),
    [schools],
  );

  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (campus && campus.id !== 'others') params.set('school', campus.label);
    navigate(`/search${params.toString() ? `?${params}` : ''}`);
  };

  const goSell = () => {
    if (!user) navigate('/login?mode=seller&next=' + encodeURIComponent('/become-seller'));
    else if (user.role !== 'seller') navigate('/become-seller');
    else navigate('/sell');
  };


  return (
    <div className="home page">
      <TopBar hideActions={false} searchPlaceholder="Search phones, books, sneakers…" />

      <HomeHero
        campus={campus}
        categories={categories}
        query={query}
        setQuery={setQuery}
        onSearch={submitSearch}
        onPickCampus={() => setPickerOpen(true)}
      />

      <main className="home-main">
        {failed && (
          <Notice
            tone="warning"
            action={<button className="link-btn" onClick={() => window.location.reload()}>Retry</button>}
          >
            We couldn't load listings. The server may be starting up, so please try again in a moment.
          </Notice>
        )}

        {campus ? (
          <>
            {/* ── Campus feed ── */}
            <section className="section">
              <SectionHead
                title={<>New at {campus.label}</>}
                sub="Latest listings from students on your campus"
                action={local.recent.length ? { label: 'See all', onClick: () => navigate(`/search?school=${encodeURIComponent(campus.label)}`) } : null}
              />
              {localLoading ? <SkeletonGrid count={5} /> : local.recent.length === 0 ? (
                <div className="empty empty--compact">
                  <span className="empty-ic"><GraduationCap size={26} /></span>
                  <h3>No listings at {campus.label} yet</h3>
                  <p>Be the first to sell on your campus, or browse listings from other campuses below.</p>
                  <div className="empty-actions">
                    <button className="btn btn-primary" onClick={goSell}><Plus size={16} /> List an item</button>
                    <button className="btn btn-ghost" onClick={() => setPickerOpen(true)}>Change campus</button>
                  </div>
                </div>
              ) : (
                <ProductGrid>
                  {local.recent.slice(0, 10).map((p) => <ProductCard key={p.id} p={p} />)}
                </ProductGrid>
              )}
            </section>

            {local.popular.length > 2 && (
              <section className="section">
                <SectionHead title={<>Popular at {campus.label}</>} sub="Most viewed on your campus" />
                <ProductRail label={`Popular at ${campus.label}`}>
                  {local.popular.map((p, i) => <ProductCard key={p.id} p={p} rank={i + 1} variant="rail" />)}
                </ProductRail>
              </section>
            )}

            {localSellers.length > 0 && (
              <section className="section">
                <SectionHead title={<>Sellers at {campus.label}</>} sub="Shops you can meet up with on campus" />
                <SellerRail sellers={localSellers} />
              </section>
            )}

            {otherCampuses.length > 0 && (
              <section className="section">
                <SectionHead
                  title="From other campuses"
                  sub="Sellers can arrange delivery to you"
                  action={{ label: 'Browse all', onClick: () => navigate('/search') }}
                />
                <ProductGrid>
                  {otherCampuses.map((p) => <ProductCard key={p.id} p={p} />)}
                </ProductGrid>
              </section>
            )}
          </>
        ) : (
          <>
            {/* ── No campus yet: make choosing one the first step ── */}
            <section className="section campus-choose" aria-labelledby="choose-title">
              <div className="campus-choose-head">
                <div>
                  <h2 id="choose-title" className="section-title">Shop your campus</h2>
                  <p className="section-sub">Pick where you study to see listings you can collect nearby.</p>
                </div>
                <button className="btn btn-soft" onClick={autoDetect} disabled={locStatus === 'prompting'}>
                  {locStatus === 'prompting' ? <Loader2 size={16} className="spin" /> : <Navigation size={16} />}
                  {locStatus === 'prompting' ? 'Locating…' : 'Use my location'}
                </button>
              </div>
              {schoolsLoading ? <Skeleton h={88} r={16} /> : (
                <div className="campus-grid">
                  {topCampuses.map((s) => (
                    <CampusTile key={s.id} school={s} />
                  ))}
                  <button className="campus-tile campus-tile--more" onClick={() => setPickerOpen(true)}>
                    <strong>Other campus</strong>
                    <span>Search the full list</span>
                  </button>
                </div>
              )}
            </section>

            <section className="section">
              <SectionHead
                title="Trending across Ghana"
                sub="The listings people are looking at most"
                action={{ label: 'View all', onClick: () => navigate('/trending') }}
              />
              {feedLoading ? <SkeletonGrid count={5} /> : feed.trending.length === 0 ? (
                <div className="empty empty--compact">
                  <span className="empty-ic"><Package size={26} /></span>
                  <h3>No listings yet</h3>
                  <p>Be the first to sell something on sBay.</p>
                  <button className="btn btn-primary" onClick={goSell}><Plus size={16} /> List an item</button>
                </div>
              ) : (
                <ProductRail label="Trending listings">
                  {feed.trending.map((p, i) => <ProductCard key={p.id} p={p} rank={i + 1} variant="rail" />)}
                </ProductRail>
              )}
            </section>

            {nationalSellers.length > 0 && (
              <section className="section">
                <SectionHead title="Trusted sellers" sub="Verified by the sBay team" />
                <SellerRail sellers={nationalSellers} />
              </section>
            )}

            {feed.recent.length > 0 && (
              <section className="section">
                <SectionHead title="Just listed" action={{ label: 'Browse all', onClick: () => navigate('/search') }} />
                <ProductGrid>
                  {feed.recent.slice(0, 10).map((p) => <ProductCard key={p.id} p={p} />)}
                </ProductGrid>
              </section>
            )}
          </>
        )}

        <section className="how" id="how" aria-labelledby="how-title">
          <h2 id="how-title">How sBay keeps your money safe</h2>
          <ol className="how-steps">
            <li>
              <span className="how-ic"><Wallet size={20} /></span>
              <strong>1. Pay into escrow</strong>
              <p>Check out with MoMo or card. sBay holds the payment, not the seller.</p>
            </li>
            <li>
              <span className="how-ic"><MessageCircle size={20} /></span>
              <strong>2. Meet up or get it delivered</strong>
              <p>Chat with the seller in the app to agree a pickup spot on campus.</p>
            </li>
            <li>
              <span className="how-ic"><PackageCheck size={20} /></span>
              <strong>3. Confirm, then they're paid</strong>
              <p>The seller receives the money only after you confirm you have the item.</p>
            </li>
          </ol>
          <div className="how-cta">
            <div>
              <strong>{user?.role === 'seller' ? 'Got something new to sell?' : 'Have something to sell?'}</strong>
              <p>List it in a minute and reach buyers{campus ? ` at ${campus.label}` : ' on your campus'}.</p>
            </div>
            <button className="btn btn-secondary" onClick={goSell}>
              <Plus size={16} /> {user?.role === 'seller' ? 'List an item' : 'Start selling'}
            </button>
          </div>
        </section>
      </main>

      <CampusPicker open={pickerOpen} onClose={closePicker} />
      <Footer />
      <BottomNav />
    </div>
  );
}

function CampusTile({ school }) {
  const { setCampus } = useCampus();
  return (
    <button className="campus-tile" onClick={() => setCampus(school)}>
      <span className="campus-tile-ic"><GraduationCap size={18} /></span>
      <strong>{school.label}</strong>
      <span>{[school.city, school.count ? `${school.count} listing${school.count === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}</span>
    </button>
  );
}

function SellerRail({ sellers }) {
  return (
    <div className="seller-rail">
      {sellers.map((s) => (
        <Link key={s.id} to={`/seller/${s.id}`} className="seller-tile">
          <Avatar src={s.avatar} name={s.name} size={52} />
          <div className="seller-tile-info">
            <strong>
              <span className="seller-tile-name">{s.name}</span>
              {s.verified && <BadgeCheck size={14} className="pcard-verified" aria-label="Verified seller" />}
            </strong>
            <span className="seller-tile-rating">
              <Star size={13} fill="currentColor" aria-hidden />
              {Number(s.rating || 0) > 0 ? Number(s.rating).toFixed(1) : 'New'}
              {s.reviews > 0 && <em>({s.reviews} review{s.reviews === 1 ? '' : 's'})</em>}
            </span>
            <span className="seller-tile-loc">
              {[s.location, s.listings ? `${s.listings} listing${s.listings === 1 ? '' : 's'}` : null].filter(Boolean).join(' · ')}
            </span>
          </div>
          <ArrowRight size={16} className="seller-tile-chev" />
        </Link>
      ))}
    </div>
  );
}

function SectionHead({ title, sub, action }) {
  return (
    <div className="section-head">
      <div>
        <h2 className="section-title">{title}</h2>
        {sub && <p className="section-sub">{sub}</p>}
      </div>
      {action && (
        <button className="view-all" onClick={action.onClick}>
          {action.label} <ArrowRight size={14} />
        </button>
      )}
    </div>
  );
}

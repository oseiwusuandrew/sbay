import { useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowRight, ShieldCheck, BadgeCheck, Smartphone, Search as SearchIcon,
  MapPin, Package, Star, Wallet, MessageCircle, PackageCheck, Plus,
} from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import Footer from '../components/Footer';
import CampusBanner from '../components/CampusBanner';
import ProductCard, { ProductGrid, ProductRail } from '../components/ProductCard';
import Avatar from '../components/Avatar';
import { sbay } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { useLocation as useCampus } from '../store/LocationContext';
import { SkeletonGrid, Skeleton } from '../components/Skeleton';
import './pages.css';
import './Home.css';

export default function Home() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { campus } = useCampus();
  const [feed, setFeed] = useState({ trending: [], recent: [], sellers: [] });
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [query, setQuery] = useState('');
  const [showAllLocal, setShowAllLocal] = useState(false);

  useEffect(() => {
    let active = true;
    sbay.getHomeFeed()
      .then((f) => { if (active) setFeed(f); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    sbay.getCategories()
      .then((cats) => { if (active) setCategories(cats.filter((c) => c.id !== 'all').slice(0, 10)); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  const { trending, recent, sellers } = feed;

  // Home used to filter only the ~24 items already on screen; real
  // search lives on /search and queries the whole catalogue.
  const submitSearch = (e) => {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/search?q=${encodeURIComponent(q)}` : '/search');
  };

  const localProducts = useMemo(() => {
    if (!campus) return [];
    const school = campus.label.toLowerCase();
    const city = (campus.city || '').toLowerCase();
    const seen = new Set();
    return [...recent, ...trending].filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      const ps = (p.school || '').toLowerCase();
      const pc = (p.city || '').toLowerCase();
      return (ps && (ps.includes(school) || school.includes(ps))) || (city && pc && (pc.includes(city) || city.includes(pc)));
    });
  }, [campus, trending, recent]);

  const featuredSellers = sellers.filter((s) => s.verified);
  const empty = !loading && !failed && trending.length === 0 && recent.length === 0;

  const goSell = () => {
    if (!user) navigate('/login?mode=seller&next=' + encodeURIComponent('/become-seller'));
    else if (user.role !== 'seller') navigate('/become-seller');
    else navigate('/sell');
  };

  return (
    <div className="home page">
      <TopBar hideActions={false} searchPlaceholder="Search phones, books, sneakers…" />

      <section className="hero">
        <div className="hero-inner">
          <div className="hero-copy">
            <span className="hero-eyebrow"><ShieldCheck size={14} /> Escrow-protected campus marketplace</span>
            <h1>Buy and sell on campus, <span>without the risk.</span></h1>
            <p className="hero-sub">
              Your money is held safely until you confirm the item reached you.
              Shop from verified students at UG, KNUST, UCC and more.
            </p>
            <form className="hero-search" onSubmit={submitSearch} role="search">
              <SearchIcon size={20} aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="What are you looking for?"
                aria-label="Search sBay"
              />
              <button type="submit" className="btn btn-primary">Search</button>
            </form>
            {categories.length > 0 && (
              <div className="hero-cats" aria-label="Popular categories">
                {categories.map((c) => (
                  <Link key={c.id} className="chip" to={`/search?category=${encodeURIComponent(c.label)}`}>
                    {c.label}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <ul className="hero-trust">
            <li>
              <span className="ht-ic"><Wallet size={18} /></span>
              <div><strong>Pay safely</strong><small>Funds held until you confirm delivery</small></div>
            </li>
            <li>
              <span className="ht-ic"><BadgeCheck size={18} /></span>
              <div><strong>Verified sellers</strong><small>Student ID checks by the sBay team</small></div>
            </li>
            <li>
              <span className="ht-ic"><Smartphone size={18} /></span>
              <div><strong>MoMo or card</strong><small>MTN, Telecel, AirtelTigo &amp; Visa via Paystack</small></div>
            </li>
          </ul>
        </div>
      </section>

      <CampusBanner />

      <main className="home-main">
        {failed && (
          <div className="notice notice--warn" role="alert">
            We couldn't load listings right now. The server may be waking up, so try again in a moment.
            <button className="link-btn" onClick={() => window.location.reload()}>Retry</button>
          </div>
        )}

        {empty ? (
          <section className="section">
            <div className="empty">
              <span className="empty-ic"><Package size={26} /></span>
              <h3>No listings yet</h3>
              <p className="muted">Be the first to sell something on your campus.</p>
              <button className="btn btn-primary" onClick={goSell}><Plus size={16} /> List an item</button>
            </div>
          </section>
        ) : (
          <>
            {campus && localProducts.length > 0 && (
              <section className="section">
                <SectionHead
                  title={<><MapPin size={18} className="sh-ic" /> Near you at {campus.label}</>}
                  action={localProducts.length > 5
                    ? { label: showAllLocal ? 'Show less' : `See all ${localProducts.length}`, onClick: () => setShowAllLocal((v) => !v) }
                    : null}
                />
                <ProductGrid>
                  {(showAllLocal ? localProducts : localProducts.slice(0, 5)).map((p) => <ProductCard key={p.id} p={p} />)}
                </ProductGrid>
              </section>
            )}

            <section className="section">
              <SectionHead
                title="Trending on campus"
                sub="Most viewed this week"
                action={{ label: 'View all', onClick: () => navigate('/trending') }}
              />
              {loading ? <SkeletonGrid count={5} /> : (
                <ProductRail label="Trending listings">
                  {trending.map((p, i) => <ProductCard key={p.id} p={p} rank={i + 1} variant="rail" />)}
                </ProductRail>
              )}
            </section>

            {(loading || featuredSellers.length > 0) && (
              <section className="section">
                <SectionHead title="Trusted campus sellers" sub="Verified by the sBay team" />
                {loading ? <Skeleton h={96} r={16} /> : (
                  <div className="seller-rail">
                    {featuredSellers.map((s) => (
                      <Link key={s.id} to={`/seller/${s.id}`} className="seller-tile">
                        <Avatar src={s.avatar} name={s.name} size={52} />
                        <div className="seller-tile-info">
                          <strong>{s.name} <BadgeCheck size={14} className="pcard-verified" aria-label="Verified" /></strong>
                          <span className="seller-tile-rating">
                            <Star size={13} fill="currentColor" aria-hidden /> {Number(s.rating || 0).toFixed(1)}
                            <em>({s.reviews} review{s.reviews === 1 ? '' : 's'})</em>
                          </span>
                          {s.location && <span className="seller-tile-loc">{s.location}</span>}
                        </div>
                        <ArrowRight size={16} className="seller-tile-chev" />
                      </Link>
                    ))}
                  </div>
                )}
              </section>
            )}

            <section className="section">
              <SectionHead
                title="Just listed"
                action={{ label: 'Browse categories', onClick: () => navigate('/categories') }}
              />
              {loading ? <SkeletonGrid count={10} /> : (
                <ProductGrid>
                  {recent.map((p) => <ProductCard key={p.id} p={p} />)}
                </ProductGrid>
              )}
            </section>
          </>
        )}

        <section className="how" aria-labelledby="how-title">
          <h2 id="how-title">How sBay keeps you safe</h2>
          <ol className="how-steps">
            <li>
              <span className="how-ic"><Wallet size={20} /></span>
              <strong>Pay into escrow</strong>
              <p>Checkout with MoMo or card. sBay holds the money, not the seller.</p>
            </li>
            <li>
              <span className="how-ic"><MessageCircle size={20} /></span>
              <strong>Meet or get delivery</strong>
              <p>Chat with the seller in-app to arrange pickup on campus.</p>
            </li>
            <li>
              <span className="how-ic"><PackageCheck size={20} /></span>
              <strong>Confirm and release</strong>
              <p>Only when you confirm you've got it does the seller get paid.</p>
            </li>
          </ol>
          <div className="how-cta">
            <div>
              <strong>Got something to sell?</strong>
              <p className="muted">List it in under a minute and reach students on your campus.</p>
            </div>
            <button className="btn btn-secondary" onClick={goSell}><Plus size={16} /> Start selling</button>
          </div>
        </section>
      </main>

      <Footer />
      <BottomNav />
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

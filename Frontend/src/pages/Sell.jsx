import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { Camera, X, Loader2, CreditCard, Lock, Star, MapPin } from 'lucide-react';
import TopBar from '../components/TopBar';
import BottomNav from '../components/BottomNav';
import ProductCard from '../components/ProductCard';
import { Notice, useToast } from '../components/Feedback';
import { sbay, productApi, paymentApi } from '../api/client';
import { mediaUrl } from '../api/config';
import { uploadPhoto } from '../utils/image';
import { ghs } from '../utils/money';
import { useAuth } from '../store/AuthContext';
import './pages.css';
import './SellForm.css';

const CONDITIONS = ['Brand New', 'Like New', 'Slightly Used', 'Used · Fair'];
const MAX_PHOTOS = 6;
const EMPTY = {
  title: '', category: '', condition: 'Like New', description: '',
  price: '', originalPrice: '', stock: '1', location: '',
};

/** Field-by-field problems, so each message can sit under its own input. */
function validate(form, photos) {
  const e = {};
  if (!photos.length) e.photos = 'Add at least one photo.';
  if (form.title.trim().length < 3) e.title = 'Give the item a name of at least 3 characters.';
  if (!form.category) e.category = 'Choose a category.';
  const price = Number(form.price);
  if (!form.price || !Number.isFinite(price) || price <= 0) e.price = 'Enter a price above GH₵ 0.';
  if (form.originalPrice && Number(form.originalPrice) <= price) {
    e.originalPrice = 'The original price must be higher than the price.';
  }
  const stock = Number(form.stock);
  if (!Number.isInteger(stock) || stock < 1) e.stock = 'Enter a whole number, 1 or more.';
  if (!form.location.trim()) e.location = 'Say where buyers can collect it.';
  return e;
}

/**
 * Create or edit a listing on one page: photos, details, price, pickup.
 * A live preview shows the card exactly as buyers will see it.
 * Routes: /sell (new), /seller/listing/:id/edit (edit).
 */
export default function Sell() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { id: routeId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const editId = routeId || params.get('edit');
  const isEdit = Boolean(editId);

  const [form, setForm] = useState(() => ({
    ...EMPTY,
    location: user?.sellerProfile?.location || user?.location || '',
  }));
  const [photos, setPhotos] = useState([]);      // stored paths or legacy URLs
  const [uploading, setUploading] = useState(0); // photos still on their way up
  const [categories, setCategories] = useState([]);
  const [onboardingFee, setOnboardingFee] = useState(0);
  const [loaded, setLoaded] = useState(!isEdit);
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  // Onboarding fee gate
  const [gateBusy, setGateBusy] = useState(false);
  const [gateErr, setGateErr] = useState('');
  const [gateVerifying, setGateVerifying] = useState(() => Boolean(params.get('onboarding_ref')));

  useEffect(() => {
    sbay.getPublicSettings().then((s) => {
      setOnboardingFee(Number(s?.sellerOnboardingFee ?? 0));
      setCategories(s?.categories || []);
    }).catch(() => {});
  }, []);

  // Back from Paystack after paying the onboarding fee.
  useEffect(() => {
    const ref = params.get('onboarding_ref');
    if (!ref) return;
    paymentApi.verifyOnboarding(ref)
      .then(() => window.history.replaceState({}, '', '/sell'))
      .catch((e) => setGateErr(e.message || 'We could not confirm that payment. Please try again.'))
      .finally(() => setGateVerifying(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    sbay.getProduct(editId).then((p) => {
      setForm({
        title: p.title || '',
        category: p.category || '',
        condition: p.condition || 'Like New',
        description: p.description || '',
        price: p.price ? String(p.price) : '',
        originalPrice: p.discountPrice ? String(p.discountPrice) : '',
        stock: String(p.stock || 1),
        location: p.location || '',
      });
      setPhotos(p.images?.length ? p.images.filter((src) => src !== '/no-photo.svg') : []);
      setLoaded(true);
    }).catch((e) => { setError(e.message || 'Could not load this listing.'); setLoaded(true); });
  }, [isEdit, editId]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const errors = useMemo(() => validate(form, photos), [form, photos]);
  const show = (k) => touched && errors[k];

  // A listing filed under a category from before the fixed list keeps it.
  const categoryOptions = form.category && !categories.includes(form.category)
    ? [form.category, ...categories]
    : categories;

  const addPhotos = async (e) => {
    const files = Array.from(e.target.files || []).slice(0, MAX_PHOTOS - photos.length - uploading);
    e.target.value = '';
    if (!files.length) return;
    setUploading((n) => n + files.length);
    await Promise.all(files.map(async (file) => {
      try {
        const path = await uploadPhoto(file);
        setPhotos((p) => (p.length < MAX_PHOTOS ? [...p, path] : p));
      } catch (err) {
        toast.error(`${file.name}: ${err.message || 'could not be uploaded'}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }));
  };
  const removePhoto = (i) => setPhotos((p) => p.filter((_, idx) => idx !== i));
  const makeCover = (i) => setPhotos((p) => [p[i], ...p.filter((_, idx) => idx !== i)]);

  const submit = async (e) => {
    e.preventDefault();
    setTouched(true);
    setError('');
    if (Object.keys(errors).length || uploading) return;
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        category: form.category,
        condition: form.condition,
        description: form.description.trim(),
        price: Number(form.price),
        discountPrice: form.originalPrice ? Number(form.originalPrice) : undefined,
        stock: Number(form.stock),
        location: form.location.trim(),
        images: photos,
      };
      if (isEdit) {
        await productApi.update(editId, payload);
        toast.success('Listing updated');
        navigate('/seller-dashboard/listings', { replace: true });
      } else {
        const created = await productApi.create(payload);
        sbay.clearListingCache();
        toast.success('Your listing is live', { action: { label: 'Add another', to: '/sell' } });
        navigate(`/product/${created.id}`, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Could not save your listing. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const payOnboarding = async () => {
    setGateBusy(true);
    setGateErr('');
    try {
      const { authorization_url: url } = await paymentApi.initializeOnboarding();
      window.location.href = url;
    } catch (err) {
      setGateErr(err.message || 'Could not start the payment. Please try again.');
      setGateBusy(false);
    }
  };

  if (gateVerifying) {
    return (
      <div className="page">
        <TopBar showBack title="Confirming payment" showSearch={false} />
        <main className="page-main sell-center">
          <Loader2 size={32} className="spin" aria-hidden="true" />
          <p className="muted">Confirming your payment…</p>
        </main>
      </div>
    );
  }

  if (!isEdit && onboardingFee > 0 && user && !user.onboardingFeePaid) {
    return (
      <div className="page">
        <TopBar showBack title="Start selling" showSearch={false} />
        <main className="page-main">
          <section className="card sell-gate">
            <span className="sell-gate-ic"><Lock size={24} /></span>
            <h2>One-time seller fee</h2>
            <p className="muted">
              Before your first listing there's a one-time fee of <strong>{ghs(onboardingFee)}</strong>.
              It keeps fake shops off sBay. You pay it once, not monthly.
            </p>
            {gateErr && <Notice tone="error">{gateErr}</Notice>}
            <button className="btn btn-primary btn-block" onClick={payOnboarding} disabled={gateBusy}>
              {gateBusy
                ? <><Loader2 size={16} className="spin" /> Opening Paystack…</>
                : <><CreditCard size={16} /> Pay {ghs(onboardingFee)}</>}
            </button>
            <p className="muted small">Paid securely through Paystack with MoMo or card.</p>
          </section>
        </main>
        <BottomNav />
      </div>
    );
  }

  const preview = {
    id: 'preview',
    title: form.title.trim() || 'Your item name',
    price: Number(form.price) || 0,
    discountPrice: Number(form.originalPrice) || undefined,
    image: photos[0] ? mediaUrl(photos[0]) : '/no-photo.svg',
    condition: form.condition,
    school: form.location.trim(),
    sellerName: user?.sellerProfile?.storeName || user?.name,
    sellerVerified: user?.verified,
    status: 'active',
    stock: Number(form.stock) || 1,
  };

  return (
    <div className="page">
      <TopBar showBack title={isEdit ? 'Edit listing' : 'Sell an item'} showSearch={false} />

      <main className="page-main">
        {!loaded ? (
          <div className="sell-center"><Loader2 size={28} className="spin" aria-hidden="true" /></div>
        ) : (
          <form className="sell-layout" onSubmit={submit} noValidate>
            <div className="sell-form">
              <section className="card sell-sec">
                <div className="sell-sec-h">
                  <h2>Photos</h2>
                  <span className="muted small">{photos.length}/{MAX_PHOTOS}</span>
                </div>
                <p className="muted small">The first photo is the cover. Show the front, the back and any marks.</p>
                <div className="sell-photos">
                  {photos.map((src, i) => (
                    <figure key={src} className="sell-photo">
                      <img src={mediaUrl(src)} alt={`Photo ${i + 1}`} />
                      {i === 0
                        ? <span className="sell-photo-cover">Cover</span>
                        : (
                          <button type="button" className="sell-photo-btn sell-photo-star" onClick={() => makeCover(i)} aria-label="Make this the cover photo">
                            <Star size={14} />
                          </button>
                        )}
                      <button type="button" className="sell-photo-btn sell-photo-x" onClick={() => removePhoto(i)} aria-label={`Remove photo ${i + 1}`}>
                        <X size={14} />
                      </button>
                    </figure>
                  ))}
                  {Array.from({ length: uploading }).map((_, i) => (
                    <div key={`up-${i}`} className="sell-photo is-loading" aria-label="Uploading photo">
                      <Loader2 size={20} className="spin" />
                    </div>
                  ))}
                  {photos.length + uploading < MAX_PHOTOS && (
                    <label className={`sell-photo sell-photo-add ${show('photos') ? 'has-error' : ''}`}>
                      <Camera size={22} aria-hidden="true" />
                      <span>Add photos</span>
                      <input type="file" accept="image/*" multiple onChange={addPhotos} hidden />
                    </label>
                  )}
                </div>
                {show('photos') && <p className="field-error">{errors.photos}</p>}
              </section>

              <section className="card sell-sec">
                <h2>About the item</h2>
                <label className="field">
                  <span>Name</span>
                  <input
                    value={form.title}
                    onChange={set('title')}
                    maxLength={140}
                    placeholder='e.g. HP EliteBook 840 G5, 16GB RAM'
                    aria-invalid={!!show('title')}
                  />
                  {show('title') && <span className="field-error">{errors.title}</span>}
                </label>

                <div className="sell-row">
                  <label className="field">
                    <span>Category</span>
                    <select value={form.category} onChange={set('category')} aria-invalid={!!show('category')}>
                      <option value="" disabled>Choose…</option>
                      {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                    {show('category') && <span className="field-error">{errors.category}</span>}
                  </label>
                  <div className="field">
                    <span id="cond-label">Condition</span>
                    <div className="sell-seg" role="radiogroup" aria-labelledby="cond-label">
                      {CONDITIONS.map((c) => (
                        <button
                          key={c}
                          type="button"
                          role="radio"
                          aria-checked={form.condition === c}
                          className={form.condition === c ? 'active' : ''}
                          onClick={() => setForm((f) => ({ ...f, condition: c }))}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <label className="field">
                  <span>Description <em className="muted">optional</em></span>
                  <textarea
                    rows={5}
                    value={form.description}
                    onChange={set('description')}
                    maxLength={5000}
                    placeholder="What's included, any faults, and anything a buyer should know."
                  />
                </label>
              </section>

              <section className="card sell-sec">
                <h2>Price</h2>
                <div className="sell-row sell-row--3">
                  <label className="field">
                    <span>Price (GH₵)</span>
                    <input
                      type="number" inputMode="decimal" min="0" step="0.01"
                      value={form.price} onChange={set('price')} placeholder="0.00"
                      aria-invalid={!!show('price')}
                    />
                    {show('price') && <span className="field-error">{errors.price}</span>}
                  </label>
                  <label className="field">
                    <span>Original price <em className="muted">optional</em></span>
                    <input
                      type="number" inputMode="decimal" min="0" step="0.01"
                      value={form.originalPrice} onChange={set('originalPrice')} placeholder="Shown crossed out"
                      aria-invalid={!!show('originalPrice')}
                    />
                    {show('originalPrice') && <span className="field-error">{errors.originalPrice}</span>}
                  </label>
                  <label className="field">
                    <span>Quantity</span>
                    <input
                      type="number" inputMode="numeric" min="1" step="1"
                      value={form.stock} onChange={set('stock')}
                      aria-invalid={!!show('stock')}
                    />
                    {show('stock') && <span className="field-error">{errors.stock}</span>}
                  </label>
                </div>
              </section>

              <section className="card sell-sec">
                <h2>Pickup</h2>
                <label className="field">
                  <span>Where can buyers collect it?</span>
                  <div className="sell-input-ic">
                    <MapPin size={16} aria-hidden="true" />
                    <input
                      value={form.location}
                      onChange={set('location')}
                      maxLength={120}
                      placeholder="e.g. Akuafo Hall, Legon"
                      aria-invalid={!!show('location')}
                    />
                  </div>
                  {show('location') && <span className="field-error">{errors.location}</span>}
                </label>
                <p className="muted small">Payment is held by sBay until the buyer confirms they have the item.</p>
              </section>

              {touched && Object.keys(errors).length > 0 && (
                <Notice tone="error">Some details are missing. Check the highlighted fields.</Notice>
              )}
              {error && <Notice tone="error">{error}</Notice>}

              <div className="sell-actions">
                <button type="button" className="btn btn-ghost" onClick={() => navigate(-1)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving || uploading > 0}>
                  {saving ? <><Loader2 size={16} className="spin" /> Saving…</>
                    : uploading ? 'Uploading photos…'
                      : isEdit ? 'Save changes' : 'Publish listing'}
                </button>
              </div>
            </div>

            <aside className="sell-preview" aria-label="Preview">
              <p className="sell-preview-label">Preview</p>
              <ProductCard p={preview} />
              {Number(form.price) > 0 && (
                <p className="muted small">
                  Buyers pay {ghs(Number(form.price))} plus a small sBay service fee, held until they confirm receipt.
                </p>
              )}
            </aside>
          </form>
        )}
      </main>

      <BottomNav />
    </div>
  );
}

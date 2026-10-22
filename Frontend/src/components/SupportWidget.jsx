import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Headphones, MessageCircle, X, Send, Loader2, GripVertical, Mail, Phone } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { api } from '../api/client';
import { Notice } from './Feedback';
import './SupportWidget.css';

/** Clamp a value between min and max. */
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default function SupportWidget() {
  const { pathname } = useLocation();
  const { user } = useAuth();

  // Show only on the homepage.
  const isHomepage = pathname === '/home';

  const [open, setOpen] = useState(false);

  // Lock body scroll when panel is open
  useEffect(() => {
    if (open) {
      document.body.classList.add('support-open');
    } else {
      document.body.classList.remove('support-open');
    }
    return () => document.body.classList.remove('support-open');
  }, [open]);

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({
    name:    user?.name || '',
    email:   user?.email || '',
    phone:   user?.phone || '',
    message: '',
  });
  const isGuest = !user;

  // ---- Drag state ----
  // Kept in a ref: it changes on every pointer move and must not trigger
  // renders (it used to be a mutated useState object).
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const drag = useRef({
    dragging: false,
    startX: 0,
    startY: 0,
    startPosX: 0,
    startPosY: 0,
    moved: false,
  });

  useEffect(() => {
    if (user) {
      setForm((f) => ({
        ...f,
        name:  user.name  || f.name,
        email: user.email || f.email,
        phone: user.phone || f.phone,
      }));
    }
  }, [user]);

  const onPointerDown = (e) => {
    if (e.button !== 0) return;
    drag.current = {
      dragging: true,
      startX: e.clientX,
      startY: e.clientY,
      startPosX: pos.x,
      startPosY: pos.y,
      moved: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    const d = drag.current;
    if (!d.dragging) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) d.moved = true;
    const span = window.innerWidth - 110;
    const maxY = window.innerHeight - 140;
    // Anchored bottom-left on mobile, bottom-right on desktop.
    const rightAnchored = window.innerWidth >= 961;
    setPos({
      x: rightAnchored ? clamp(d.startPosX + dx, -span, 0) : clamp(d.startPosX + dx, 0, span),
      y: clamp(d.startPosY + dy, -(maxY), 0),
    });
  };

  const onPointerUp = (e) => {
    drag.current.dragging = false;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (!drag.current.moved) setOpen((o) => !o);
  };

  // The FAB is a div (for pointer capture), so give it button keyboard behaviour.
  const onFabKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setOpen((o) => !o);
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.email.trim()) errs.email = 'Enter your email address.';
    if (!form.phone.trim() || form.phone.trim().length < 7) errs.phone = 'Enter a valid phone number.';
    if (!form.message.trim()) errs.message = 'Tell us how we can help.';
    setFieldErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSending(true);
    setError('');
    try {
      await api.post('/support/tickets', {
        name:    form.name.trim() || undefined,
        email:   form.email.trim(),
        phone:   form.phone.trim(),
        message: form.message.trim(),
      });
      setSent(true);
      setFieldErrors({});
      setForm((f) => ({ ...f, message: '' }));
    } catch (err) {
      setError(err?.message || "We couldn't send your message. Please try again.");
    } finally {
      setSending(false);
    }
  };

  if (!isHomepage) return null;

  return (
    <>
      <div
        className="support-fab"
        style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onKeyDown={onFabKey}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        aria-label={open ? 'Close support form' : 'Contact support'}
      >
        <GripVertical size={14} className="support-grip" />
        {open ? <X size={22} /> : <MessageCircle size={22} />}
      </div>

      {open && (
        <div className="support-panel" style={{ transform: `translate(${pos.x}px, ${pos.y}px)` }}>
          <header className="support-header">
            <span className="support-header-icon"><Headphones size={18} /></span>
            <div>
              <strong>Help &amp; support</strong>
              <small>Message the sBay team. We reply by email, usually within a few hours.</small>
            </div>
            <button className="support-close" onClick={() => setOpen(false)} aria-label="Close">
              <X size={16} />
            </button>
          </header>

          <form className="support-form" onSubmit={submit}>
            {isGuest && (
              <p className="support-guest-note">
                You don't need an account. Leave your email and phone number so we can get back to you.
              </p>
            )}

            {isGuest && (
              <label className="support-field">
                <span>Your name</span>
                <div className="support-input-wrap">
                  <input
                    type="text"
                    placeholder="Full name (optional)"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  />
                </div>
              </label>
            )}

            <label className="support-field">
              <span>Email</span>
              <div className={`support-input-wrap ${fieldErrors.email ? 'has-err' : ''}`}>
                <Mail size={15} />
                <input
                  type="email"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setFieldErrors((x) => ({ ...x, email: '' })); }}
                  readOnly={!!user?.email}
                />
              </div>
              {fieldErrors.email && <span className="support-field-err">{fieldErrors.email}</span>}
            </label>

            <label className="support-field">
              <span>Phone number</span>
              <div className={`support-input-wrap ${fieldErrors.phone ? 'has-err' : ''}`}>
                <Phone size={15} />
                <input
                  type="tel"
                  placeholder="e.g. 0244123456"
                  value={form.phone}
                  onChange={(e) => { setForm((f) => ({ ...f, phone: e.target.value })); setFieldErrors((x) => ({ ...x, phone: '' })); }}
                />
              </div>
              {fieldErrors.phone && <span className="support-field-err">{fieldErrors.phone}</span>}
            </label>

            <label className="support-field">
              <span>How can we help?</span>
              <textarea
                placeholder="Describe the issue, and include an order number if you have one."
                value={form.message}
                onChange={(e) => { setForm((f) => ({ ...f, message: e.target.value })); setFieldErrors((x) => ({ ...x, message: '' })); }}
                rows={4}
                className={fieldErrors.message ? 'has-err' : ''}
              />
              {fieldErrors.message && <span className="support-field-err">{fieldErrors.message}</span>}
            </label>

            {error && <Notice tone="error">{error}</Notice>}
            {sent && <Notice tone="success">Thanks, your message has been sent. We'll reply by email soon.</Notice>}

            <button
              type="submit"
              className="btn btn-primary support-submit"
              disabled={sending}
            >
              {sending ? <Loader2 size={18} className="spin" /> : <Send size={18} />}
              <span>{sending ? 'Sending…' : 'Send Message'}</span>
            </button>
          </form>
        </div>
      )}
    </>
  );
}

import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { useAuth } from '../store/AuthContext';
import { api } from '../api/client';
import { Notice } from './Feedback';

const TOPICS = ['An order', 'A payment or refund', 'Selling on sBay', 'My account', 'Reporting a listing or user', 'Something else'];

/**
 * Message the sBay team. Lands in the admin support inbox; replies go by
 * email. Signed-in users only need to write their message.
 */
export default function ContactForm() {
  const { user } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', phone: user?.phone || '', topic: TOPICS[0], message: '' });
  const [errors, setErrors] = useState({});
  const [state, setState] = useState({ sending: false, sent: false, error: '' });
  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: '' })); };

  const email = user?.email || form.email.trim();
  const name = user?.name || form.name.trim();

  const submit = async (e) => {
    e.preventDefault();
    const errs = {};
    if (!email) errs.email = 'Enter your email so we can reply.';
    if (form.phone.replace(/\D/g, '').length < 9) errs.phone = 'Enter a phone number we can reach you on.';
    if (form.message.trim().length < 10) errs.message = 'Tell us a little more (at least 10 characters).';
    setErrors(errs);
    if (Object.keys(errs).length) return;

    setState({ sending: true, sent: false, error: '' });
    try {
      await api.post('/support/tickets', {
        name: name || undefined,
        email,
        phone: form.phone.trim(),
        subject: form.topic,
        message: form.message.trim(),
      });
      setForm((f) => ({ ...f, message: '' }));
      setState({ sending: false, sent: true, error: '' });
    } catch (err) {
      setState({ sending: false, sent: false, error: err.message || "We couldn't send your message. Please try again." });
    }
  };

  return (
    <form className="contact-form" onSubmit={submit} noValidate>
      {!user && (
        <div className="contact-row">
          <label className="field">
            <span>Name <em className="muted">optional</em></span>
            <input value={form.name} onChange={set('name')} autoComplete="name" maxLength={80} />
          </label>
          <label className="field">
            <span>Email</span>
            <input type="email" value={form.email} onChange={set('email')} autoComplete="email" aria-invalid={!!errors.email} />
            {errors.email && <span className="field-error">{errors.email}</span>}
          </label>
        </div>
      )}
      <div className="contact-row">
        <label className="field">
          <span>Phone</span>
          <input type="tel" inputMode="tel" value={form.phone} onChange={set('phone')} autoComplete="tel" placeholder="024 123 4567" aria-invalid={!!errors.phone} />
          {errors.phone && <span className="field-error">{errors.phone}</span>}
        </label>
        <label className="field">
          <span>What's it about?</span>
          <select value={form.topic} onChange={set('topic')}>
            {TOPICS.map((t) => <option key={t}>{t}</option>)}
          </select>
        </label>
      </div>
      <label className="field">
        <span>Message</span>
        <textarea
          rows={5}
          value={form.message}
          onChange={set('message')}
          maxLength={4000}
          placeholder="Include your order number (it starts with SB-) if this is about an order."
          aria-invalid={!!errors.message}
        />
        {errors.message && <span className="field-error">{errors.message}</span>}
      </label>

      {state.error && <Notice tone="error">{state.error}</Notice>}
      {state.sent && <Notice tone="success">Message sent. We'll reply to {email} by email.</Notice>}

      <button type="submit" className="btn btn-primary contact-submit" disabled={state.sending}>
        {state.sending ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
        {state.sending ? 'Sending…' : 'Send message'}
      </button>
    </form>
  );
}

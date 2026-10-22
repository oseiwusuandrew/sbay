import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../api/client';
import { LifeBuoy, Mail, Phone, Search, Send, User } from 'lucide-react';
import { useSocket } from '../hooks/useSocket';
import { useAdminConfirm } from './AdminConfirmContext';
import { useToast } from '../components/Feedback';

/**
 * Customer-support inbox.
 *
 * Phase 1 ships the surface; Phase 3 wires the backend (live tickets
 * from the customer-service widget on the public site, email replies).
 * This page therefore degrades gracefully if `/support/tickets` is not
 * yet available.
 */
export default function AdminSupport() {
  const { confirm } = useAdminConfirm();
  const toast = useToast();
  const [tickets, setTickets] = useState([]);
  const [active, setActive]   = useState(null);
  const [reply, setReply]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [err, setErr]         = useState('');
  const [filter, setFilter]   = useState('open');
  const [q, setQ]             = useState('');

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await adminApi.get('/support/tickets', {
        params: { status: filter || undefined, q: q.trim() || undefined },
      });
      const sorted = [...(data.items || [])].sort(
        (a, b) => new Date(b.lastMessageAt || b.createdAt) - new Date(a.lastMessageAt || a.createdAt)
      );
      setTickets(sorted);
      setActive((cur) => cur && sorted.find((t) => t._id === cur._id) ? cur : sorted[0] || null);
    } catch (e) {
      setErr(e.message || 'Could not load tickets.');
      setTickets([]); setActive(null);
    } finally { setBusy(false); }
  }, [filter, q]);

  useEffect(() => { load(); }, [load]);

  // Real-time refresh when a new support ticket comes in.
  const { on, off, connected } = useSocket();
  useEffect(() => {
    if (!connected) return;
    const handler = () => load();
    on('support:new', handler);
    return () => off('support:new', handler);
  }, [connected, on, off, load]);

  const sendReply = async (e) => {
    e.preventDefault();
    if (!reply.trim() || !active) return;
    try {
      await adminApi.post(`/support/tickets/${active._id}/reply`, { body: reply.trim() });
      setReply('');
      load();
    } catch (e) { toast.error(e.message || 'Could not send reply.'); }
  };

  const close = async (t) => {
    if (!(await confirm('Mark this ticket as resolved?', { title: 'Resolve Ticket', danger: false }))) return;
    try {
      await adminApi.post(`/support/tickets/${t._id}/close`);
      load();
    } catch (e) { toast.error(e.message || 'Could not close ticket.'); }
  };

  return (
    <>
      <h1>Support inbox</h1>
      <p className="muted">
        Messages from the customer-service widget on the public site. Replies are emailed
        to the customer (or sent in-app for registered users).
      </p>

      <div className="admin-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="support-grid">
          <aside className="support-list">
            <div className="support-tools">
              <form onSubmit={(e) => { e.preventDefault(); load(); }} className="admin-toolbar" style={{ margin: 0 }}>
                <Search size={14} />
                <input
                  placeholder="Search name, email, subject…"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  style={{ minWidth: 0 }}
                />
              </form>
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="">All</option>
              </select>
            </div>
            <ul>
              {tickets.map((t) => (
                <li
                  key={t._id}
                  className={active?._id === t._id ? 'active' : ''}
                  onClick={() => setActive(t)}
                >
                  <div className="t-name">
                    <strong>{t.name || t.user?.name || 'Anonymous'}</strong>
                    <span className={`admin-pill ${t.status === 'open' ? 'warn' : 'mute'}`}>{t.status || 'open'}</span>
                  </div>
                  <div className="muted small">{t.email || t.user?.email}</div>
                  <p className="t-preview">{t.lastMessage || t.subject}</p>
                  <small className="muted">
                    {new Date(t.lastMessageAt || t.createdAt).toLocaleString()}
                  </small>
                </li>
              ))}
              {!tickets.length && !busy && (
                <li className="t-empty">
                  <LifeBuoy size={28} />
                  <p>{err ? 'Endpoint not live yet.' : 'No tickets match.'}</p>
                </li>
              )}
            </ul>
          </aside>

          <section className="support-thread">
            {active ? (
              <>
                <header className="support-thread-h">
                  <div>
                    <h2 style={{ margin: 0 }}>{active.subject || 'Support request'}</h2>
                    <div className="support-meta">
                      <span><User size={13} /> {active.name || active.user?.name || 'Anonymous'}</span>
                      <span><Mail size={13} /> {active.email || active.user?.email || '—'}</span>
                      {active.phone && <span><Phone size={13} /> {active.phone}</span>}
                    </div>
                  </div>
                  <div className="admin-actions">
                    {active.email && (
                      <a className="btn btn-ghost" href={`mailto:${active.email}?subject=${encodeURIComponent('Re: ' + (active.subject || 'sBay support'))}`}>
                        <Mail size={14} /> Email directly
                      </a>
                    )}
                    {active.status !== 'resolved' && (
                      <button className="btn btn-ghost" onClick={() => close(active)}>Mark resolved</button>
                    )}
                  </div>
                </header>

                <div className="support-msgs">
                  {(active.messages || []).map((m, i) => (
                    <div key={i} className={`support-msg ${m.fromAdmin ? 'admin' : 'user'}`}>
                      <div className="bubble">{m.body}</div>
                      <small className="muted">
                        {m.fromAdmin ? 'You' : (active.name || 'Customer')} ·{' '}
                        {new Date(m.at).toLocaleString()}
                      </small>
                    </div>
                  ))}
                  {!(active.messages || []).length && (
                    <p className="muted small">No messages on this ticket yet.</p>
                  )}
                </div>

                <form className="support-reply" onSubmit={sendReply}>
                  <textarea
                    rows={3}
                    placeholder="Type a reply… (sent to the customer's email)"
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                  />
                  <button className="btn btn-primary" disabled={!reply.trim()}>
                    <Send size={14} /> Send reply
                  </button>
                </form>
              </>
            ) : (
              <div className="admin-empty" style={{ alignSelf: 'center', margin: 'auto' }}>
                <LifeBuoy size={36} />
                <h3>Pick a ticket</h3>
                <p>Select a conversation on the left to view and reply.</p>
              </div>
            )}
          </section>
        </div>
      </div>

      <style>{`
        .support-grid {
          display: grid;
          grid-template-columns: 340px 1fr;
          min-height: 560px;
        }
        @media (max-width: 880px) { .support-grid { grid-template-columns: 1fr; } }
        .support-list { border-right: 1px solid var(--a-border); display: flex; flex-direction: column; min-height: 0; }
        .support-tools { display: flex; gap: 8px; padding: 12px; border-bottom: 1px solid var(--a-border); align-items: center; }
        .support-tools select { padding: 8px 10px; border: 1px solid var(--a-border); border-radius: 8px; font: inherit; }
        .support-list ul { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; min-height: 200px; }
        .support-list li { padding: 12px 14px; border-bottom: 1px solid var(--a-border-2); cursor: pointer; }
        .support-list li:hover { background: var(--a-bg); }
        .support-list li.active { background: #e6f4ec; }
        .support-list .t-name { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
        .support-list .t-preview { margin: 4px 0; font-size: .85rem; color: var(--a-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
        .t-empty { display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 32px 16px; color: var(--a-muted); cursor: default; }
        .t-empty:hover { background: transparent; }

        .support-thread { display: flex; flex-direction: column; min-width: 0; }
        .support-thread-h { padding: 16px 20px; border-bottom: 1px solid var(--a-border); display: flex; gap: 12px; align-items: flex-start; justify-content: space-between; flex-wrap: wrap; }
        .support-meta { display: flex; gap: 14px; flex-wrap: wrap; color: var(--a-muted); font-size: .82rem; margin-top: 4px; }
        .support-meta span { display: inline-flex; align-items: center; gap: 5px; }
        .support-msgs { flex: 1; overflow-y: auto; padding: 18px 20px; display: flex; flex-direction: column; gap: 12px; min-height: 200px; }
        .support-msg { display: flex; flex-direction: column; max-width: 78%; }
        .support-msg.admin { align-self: flex-end; align-items: flex-end; }
        .support-msg.user { align-self: flex-start; }
        .support-msg .bubble { padding: 10px 14px; border-radius: 12px; background: var(--a-bg); color: var(--a-text); white-space: pre-wrap; }
        .support-msg.admin .bubble { background: linear-gradient(135deg, var(--a-primary), var(--a-primary-2)); color: #fff; }
        .support-msg small { margin-top: 4px; font-size: .72rem; }

        .support-reply { display: grid; gap: 10px; padding: 14px 20px; border-top: 1px solid var(--a-border); background: #fafbf6; }
        .support-reply textarea {
          font: inherit; padding: 10px 12px; border-radius: 10px;
          border: 1px solid var(--a-border); resize: vertical; min-height: 60px;
        }
        .support-reply textarea:focus { border-color: var(--a-primary); outline: none; box-shadow: 0 0 0 3px rgba(10,126,62,.14); }
        .support-reply .btn { justify-self: end; }
      `}</style>
    </>
  );
}

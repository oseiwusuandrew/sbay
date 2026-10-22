import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { adminApi } from '../api/client';
import { useAdminConfirm } from './AdminConfirmContext';
import {
  Search, Banknote, Undo2, X, Package, User, Store, MapPin,
  Calendar, Hash, ArrowRight, ClipboardList,
} from 'lucide-react';
import { Notice } from '../components/Feedback';

/**
 * Orders + escrow management.
 *
 * - Clicking any row opens a full order-detail drawer.
 * - "Release" pays the seller and marks the order completed.
 * - "Refund" cancels the order, restores stock, and refunds the buyer.
 */
export default function AdminOrders() {
  const { confirm, prompt } = useAdminConfirm();
  const [params] = useSearchParams();
  const [items, setItems]         = useState([]);
  const [q, setQ]                 = useState('');
  const [status, setStatus]       = useState('');
  // Honour dashboard deep links such as ?escrow=held.
  const [escrowStatus, setEscrow] = useState(params.get('escrow') || '');
  const [busy, setBusy]           = useState(false);
  const [err, setErr]             = useState('');
  const [detail, setDetail]       = useState(null); // selected order

  const load = useCallback(async () => {
    setBusy(true); setErr('');
    try {
      const { data } = await adminApi.get('/orders', {
        params: {
          q: q.trim() || undefined,
          status: status || undefined,
          escrowStatus: escrowStatus || undefined,
        },
      });
      const sorted = [...(data.items || [])].sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
      setItems(sorted);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }, [q, status, escrowStatus]);

  const [now] = useState(() => Date.now());
  const isNew = (date) => now - new Date(date).getTime() < 24 * 3600 * 1000;

  useEffect(() => { load(); }, [load]);

  // Merge the server's updated order into the open drawer. (It used to
  // re-query by Mongo id against the invoice-number search, which never
  // matched, so the drawer kept showing stale escrow state.)
  const applyUpdate = (updated) => {
    if (!updated) return;
    setDetail((cur) => (cur?._id === updated._id
      ? { ...cur, status: updated.status, escrow: updated.escrow, timeline: updated.timeline }
      : cur));
  };

  const release = async (id) => {
    if (!(await confirm('Release escrow funds to the seller? This cannot be undone.'))) return;
    try {
      const { data } = await adminApi.post(`/orders/${id}/release-escrow`);
      applyUpdate(data.order);
      load();
    } catch (e) { setErr(e.message || 'Could not release escrow.'); }
  };

  const refund = async (id) => {
    const reason = await prompt('Reason for refund (will be saved on the order):', { title: 'Refund Order', placeholder: 'Enter reason…' });
    if (!reason) return;
    try {
      const { data } = await adminApi.post(`/orders/${id}/refund-escrow`, { reason });
      applyUpdate(data.order);
      load();
    } catch (e) { setErr(e.message || 'Could not refund escrow.'); }
  };

  const ESCROW_CLASS = {
    held:     'warn',
    released: '',
    refunded: 'bad',
  };

  const STATUS_COLOR = {
    pending:    '#b07306',
    processing: '#1976D2',
    shipped:    '#7B1FA2',
    delivered:  '#0A7E3E',
    completed:  '#0A7E3E',
    canceled:   '#a4302a',
  };

  return (
    <>
      <h1>Orders &amp; Escrow</h1>
      <p className="muted">{items.length} orders. Click any row to view full details.</p>

      <div className="admin-card">
        <form className="admin-toolbar" onSubmit={(e) => { e.preventDefault(); load(); }}>
          <Search size={16} />
          <input
            placeholder="Invoice or buyer name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">Any status</option>
            <option value="pending">Pending</option>
            <option value="processing">Processing</option>
            <option value="shipped">Shipped</option>
            <option value="delivered">Delivered</option>
            <option value="completed">Completed</option>
            <option value="canceled">Canceled</option>
          </select>
          <select value={escrowStatus} onChange={(e) => setEscrow(e.target.value)}>
            <option value="">Any escrow</option>
            <option value="held">Held</option>
            <option value="released">Released</option>
            <option value="refunded">Refunded</option>
          </select>
          <button className="btn btn-primary" disabled={busy}>{busy ? 'Loading…' : 'Apply'}</button>
        </form>

        {err && <Notice tone="error">{err}</Notice>}

        <table className="admin-table">
          <thead>
            <tr>
              <th>Invoice</th>
              <th>Buyer</th>
              <th>Seller</th>
              <th>Total</th>
              <th>Status</th>
              <th>Escrow</th>
              <th style={{ width: 200 }}>Actions</th>
              <th style={{ width: 40 }}></th>
            </tr>
          </thead>
          <tbody>
            {items.map((o) => (
              <tr
                key={o._id}
                className="row-link"
                onClick={() => setDetail(o)}
                style={{ cursor: 'pointer' }}
              >
                <td>
                  <div>
                    <strong>{o.invoiceNumber || o._id}</strong>
                    {isNew(o.createdAt) && <span className="admin-new-badge">NEW</span>}
                  </div>
                  <div className="admin-date" style={{ marginTop: 4 }}>
                    {new Date(o.createdAt).toLocaleString()}
                  </div>
                </td>
                <td>
                  {o.buyer?.name}
                  <div className="muted small">{o.buyer?.email}</div>
                </td>
                <td>
                  {o.seller?.name}
                  <div className="muted small">{o.seller?.email}</div>
                </td>
                <td>GH₵ {Number(o.total).toLocaleString()}</td>
                <td>
                  <span
                    className="admin-pill"
                    style={{
                      background: `${STATUS_COLOR[o.status] || '#888'}22`,
                      color: STATUS_COLOR[o.status] || '#888',
                    }}
                  >
                    {o.status}
                  </span>
                </td>
                <td>
                  <span className={`admin-pill ${ESCROW_CLASS[o.escrow?.status] || ''}`}>
                    {o.escrow?.status || '—'}
                  </span>
                </td>
                <td onClick={(e) => e.stopPropagation()}>
                  <div className="admin-actions">
                    {o.escrow?.status === 'held' && (
                      <>
                        <button className="btn btn-primary" onClick={() => release(o._id)}>
                          <Banknote size={14} /> Release
                        </button>
                        <button className="btn btn-ghost" onClick={() => refund(o._id)}>
                          <Undo2 size={14} /> Refund
                        </button>
                      </>
                    )}
                  </div>
                </td>
                <td>
                  <ArrowRight size={15} style={{ color: 'var(--a-muted)', verticalAlign: 'middle' }} />
                </td>
              </tr>
            ))}
            {!items.length && !busy && (
              <tr><td colSpan={8}>
                <div className="admin-empty">
                  <ClipboardList size={32} />
                  <h3>No orders match these filters.</h3>
                </div>
              </td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Order Detail Drawer ── */}
      {detail && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 200,
            background: 'rgba(8,14,11,.45)',
            backdropFilter: 'blur(2px)',
            display: 'flex', justifyContent: 'flex-end',
          }}
          onClick={() => setDetail(null)}
        >
          <div
            style={{
              width: 540, maxWidth: '100vw',
              background: '#fff', height: '100%',
              overflowY: 'auto', padding: '28px 28px 48px',
              display: 'flex', flexDirection: 'column', gap: 22,
              boxShadow: '-4px 0 32px rgba(0,0,0,.18)',
              animation: 'slideInRight .22s ease',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
                  Order Details
                </h2>
                <p style={{ margin: '3px 0 0', fontSize: '.82rem', color: 'var(--a-muted)' }}>
                  {detail.invoiceNumber || detail._id}
                </p>
              </div>
              <button
                onClick={() => setDetail(null)}
                style={{
                  background: 'var(--a-bg)', border: '1px solid var(--a-border)',
                  width: 36, height: 36, borderRadius: 9, cursor: 'pointer',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Status + Escrow */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <span
                className="admin-pill"
                style={{
                  padding: '5px 14px', fontSize: '.8rem',
                  background: `${STATUS_COLOR[detail.status] || '#888'}22`,
                  color: STATUS_COLOR[detail.status] || '#888',
                }}
              >
                {detail.status}
              </span>
              <span className={`admin-pill ${ESCROW_CLASS[detail.escrow?.status] || ''}`}
                style={{ padding: '5px 14px', fontSize: '.8rem' }}>
                Escrow: {detail.escrow?.status || '—'}
              </span>
            </div>

            {/* Order items */}
            {(detail.items?.length > 0 || detail.product) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <h4 style={{ margin: 0, fontSize: '.78rem', fontWeight: 700, color: 'var(--a-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                  Items ordered ({detail.items?.length || 1})
                </h4>
                {(detail.items?.length ? detail.items : [{ product: detail.product, qty: detail.quantity ?? 1, price: detail.subtotal }]).map((item, i) => (
                  <div key={i} style={{
                    display: 'flex', gap: 12, alignItems: 'center',
                    background: 'var(--a-bg)', borderRadius: 10, padding: '10px 12px',
                    border: '1px solid var(--a-border)',
                  }}>
                    {item.product?.images?.[0] && (
                      <img
                        src={item.product.images[0]}
                        alt={item.product.title}
                        style={{ width: 56, height: 56, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, fontSize: '.9rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {item.product?.title || '—'}
                      </div>
                      <div style={{ color: 'var(--a-muted)', fontSize: '.8rem', marginTop: 2 }}>
                        Qty: {item.qty ?? 1} &nbsp;·&nbsp; GH₵ {Number(item.price ?? 0).toLocaleString()} each
                      </div>
                      {item.product?.category && (
                        <div style={{ fontSize: '.75rem', color: 'var(--a-primary)', marginTop: 2 }}>
                          {item.product.category}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Key info grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {[
                { icon: Hash,      label: 'Invoice',    value: detail.invoiceNumber || detail._id },
                { icon: Calendar,  label: 'Placed',     value: new Date(detail.createdAt).toLocaleString() },
                { icon: User,      label: 'Buyer',      value: `${detail.buyer?.name || '—'} · ${detail.buyer?.email || ''}` },
                { icon: Store,     label: 'Seller',     value: `${detail.seller?.name || '—'} · ${detail.seller?.email || ''}` },
                { icon: MapPin,    label: 'Delivery',   value: detail.deliveryLocation || detail.buyer?.location || '—' },
                { icon: Package,   label: 'Total',      value: `GH₵ ${Number(detail.total).toLocaleString()}` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} style={{
                  background: 'var(--a-bg)', border: '1px solid var(--a-border)',
                  borderRadius: 10, padding: '12px 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
                    <Icon size={13} style={{ color: 'var(--a-primary)', flexShrink: 0 }} />
                    <span style={{ fontSize: '.7rem', fontWeight: 700, color: 'var(--a-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                      {label}
                    </span>
                  </div>
                  <div style={{ fontSize: '.88rem', fontWeight: 600, wordBreak: 'break-word' }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Escrow breakdown */}
            <div style={{
              background: 'var(--a-bg)', border: '1px solid var(--a-border)',
              borderRadius: 12, padding: '14px 16px',
            }}>
              <h4 style={{ margin: '0 0 10px', fontSize: '.85rem', fontWeight: 700, color: 'var(--a-text-2)', textTransform: 'uppercase', letterSpacing: '.06em' }}>
                Escrow Breakdown
              </h4>
              {[
                { label: 'Subtotal',     value: `GH₵ ${Number(detail.subtotal ?? detail.total).toLocaleString()}` },
                { label: 'Service fee', value: `GH₵ ${Number(detail.fee ?? 0).toLocaleString()}` },
                { label: 'Total held',  value: `GH₵ ${Number(detail.total).toLocaleString()}`, bold: true },
                detail.escrow?.releasedAt && { label: 'Released at', value: new Date(detail.escrow.releasedAt).toLocaleString() },
                detail.escrow?.refundedAt && { label: 'Refunded at', value: new Date(detail.escrow.refundedAt).toLocaleString() },
                detail.escrow?.refundReason && { label: 'Refund reason', value: detail.escrow.refundReason },
              ].filter(Boolean).map(({ label, value, bold }) => (
                <div key={label} style={{
                  display: 'flex', justifyContent: 'space-between',
                  padding: '6px 0',
                  borderBottom: '1px solid var(--a-border-2)',
                  fontSize: '.88rem',
                }}>
                  <span style={{ color: 'var(--a-muted)' }}>{label}</span>
                  <span style={{ fontWeight: bold ? 700 : 500 }}>{value}</span>
                </div>
              ))}
            </div>

            {/* Actions */}
            {detail.escrow?.status === 'held' && (
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, minWidth: 140, justifyContent: 'center' }}
                  onClick={() => release(detail._id)}
                >
                  <Banknote size={16} /> Release to Seller
                </button>
                <button
                  className="btn btn-danger"
                  style={{ flex: 1, minWidth: 140, justifyContent: 'center' }}
                  onClick={() => refund(detail._id)}
                >
                  <Undo2 size={16} /> Refund Buyer
                </button>
              </div>
            )}

            {detail.escrow?.status !== 'held' && (
              <p style={{ color: 'var(--a-muted)', fontSize: '.85rem', textAlign: 'center', margin: 0 }}>
                No escrow actions available — funds have been {detail.escrow?.status || 'processed'}.
              </p>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(40px); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
      `}</style>
    </>
  );
}

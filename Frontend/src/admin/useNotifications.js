import { useCallback, useEffect, useRef, useState } from 'react';
import { adminApi } from '../api/client';
import { useSocket } from '../hooks/useSocket';
import { readSeen as readSeenKey, writeSeen as writeSeenKey } from '../utils/seenStore';

/**
 * Notifications layer for the admin shell.
 *
 * Combines polling (every 30s) with Socket.IO real-time events.
 * When a socket event arrives, we inject a temporary item and
 * refresh from the server to get the full list.
 */

const SEEN_KEY = 'sbay.admin.seenNotes';
const readSeen = () => readSeenKey(SEEN_KEY);
const writeSeen = (set) => writeSeenKey(SEEN_KEY, set, 500);

export function useNotifications() {
  const [items, setItems] = useState([]);
  const seenRef = useRef(readSeen());
  const { on, off, connected } = useSocket();

  const tick = useCallback(async () => {
    try {
      const { data } = await adminApi.get('/notifications');
      const next = (data?.items || []).map((n) => ({
        ...n,
        read: seenRef.current.has(n.id),
      }));
      setItems(next);
    } catch {
      // Silent — endpoint may not be live yet. Keep local list.
    }
  }, []);

  // Polling fallback.
  useEffect(() => {
    tick();
    const t = setInterval(tick, 30_000);
    return () => clearInterval(t);
  }, [tick]);

  // Real-time socket events.
  useEffect(() => {
    if (!connected) return;

    const handleSupport = (payload) => {
      // Inject a temporary notification and refresh.
      setItems((cur) => [
        { id: `support-${Date.now()}`, kind: 'support', message: `New support ticket: ${payload.subject || 'No subject'}`, at: new Date().toISOString(), href: '/admin/support', read: false },
        ...cur,
      ]);
      tick();
    };

    const handleVerification = (payload) => {
      setItems((cur) => [
        { id: `verification-${Date.now()}`, kind: 'verification', message: payload.message || 'New verification request', at: new Date().toISOString(), href: '/admin/verification/students', read: false },
        ...cur,
      ]);
      tick();
    };

    const handleUser = (payload) => {
      setItems((cur) => [
        { id: `user-${Date.now()}`, kind: 'user', message: payload.message || 'New user joined', at: new Date().toISOString(), href: '/admin/users', read: false },
        ...cur,
      ]);
      tick();
    };

    const handleOrder = (payload) => {
      setItems((cur) => [
        { id: `order-${Date.now()}`, kind: 'order', message: payload.message || 'New order received', at: new Date().toISOString(), href: '/admin/orders', read: false },
        ...cur,
      ]);
      tick();
    };

    on('support:new', handleSupport);
    on('verification:new', handleVerification);
    on('user:new', handleUser);
    on('order:new', handleOrder);

    return () => {
      off('support:new', handleSupport);
      off('verification:new', handleVerification);
      off('user:new', handleUser);
      off('order:new', handleOrder);
    };
  }, [connected, on, off, tick]);

  const markAllRead = useCallback(() => {
    const s = seenRef.current;
    items.forEach((n) => s.add(n.id));
    writeSeen(s);
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
  }, [items]);

  const markRead = useCallback((id) => {
    if (!id) return;
    const s = seenRef.current;
    s.add(id);
    writeSeen(s);
    setItems((cur) => cur.map((n) => (n.id === id ? { ...n, read: true } : n)));
  }, []);

  const unread = items.reduce((n, x) => n + (x.read ? 0 : 1), 0);
  return { items, unread, markAllRead, markRead, refresh: tick };
}

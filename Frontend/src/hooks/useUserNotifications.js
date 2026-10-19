import { useCallback, useEffect, useRef, useState } from 'react';
import { notificationApi } from '../api/client';
import { useAuth } from '../store/AuthContext';
import { useSocket } from './useSocket';
import { readSeen as readSeenKey, writeSeen as writeSeenKey } from '../utils/seenStore';

const SEEN_KEY = 'sbay.user.seenNotes';
const readSeen = (userId) => readSeenKey(`${SEEN_KEY}.${userId}`);
const writeSeen = (userId, set) => writeSeenKey(`${SEEN_KEY}.${userId}`, set, 300);

export function useUserNotifications() {
  const { user } = useAuth();
  const { on, off, connected } = useSocket();
  const [items, setItems] = useState([]);
  const seenRef = useRef(new Set());

  useEffect(() => {
    seenRef.current = user ? readSeen(user.id || user._id) : new Set();
  }, [user]);

  const refresh = useCallback(async () => {
    if (!user || user.role === 'admin') {
      setItems([]);
      return;
    }
    try {
      const next = await notificationApi.mine();
      setItems(next.map((n) => ({ ...n, read: seenRef.current.has(n.id) })));
    } catch {
      setItems((cur) => cur.length ? cur : []);
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 45_000);
    return () => clearInterval(t);
  }, [refresh]);

  useEffect(() => {
    if (!connected || !user) return undefined;

    const inject = (item) => {
      setItems((cur) => [{ ...item, id: `${item.type}-${Date.now()}`, at: new Date().toISOString(), read: false }, ...cur]);
      refresh();
    };

    const onOrder = (payload) => inject({
      type: 'order',
      title: 'Order update',
      body: payload?.status ? `Order is now ${payload.status}.` : 'You have new order activity.',
      // Prefer the link the server sent; the old ?tab= links were ignored.
      href: payload?.href || (user.role === 'seller' ? '/seller-dashboard/sales' : '/profile/orders'),
    });
    const onMessage = (payload) => inject({
      type: 'message',
      title: 'New message',
      body: payload?.text || 'You received a new chat message.',
      href: payload?.href || '/chats',
    });
    const onSupport = (payload) => inject({
      type: 'support',
      title: 'Support replied',
      body: payload?.body || 'Customer support replied to your ticket.',
      href: '/notifications',
    });

    on('order:new', onOrder);
    on('order:updated', onOrder);
    on('message:new', onMessage);
    on('support:reply', onSupport);
    return () => {
      off('order:new', onOrder);
      off('order:updated', onOrder);
      off('message:new', onMessage);
      off('support:reply', onSupport);
    };
  }, [connected, on, off, refresh, user]);

  const markAllRead = useCallback(() => {
    if (!user) return;
    const id = user.id || user._id;
    const seen = seenRef.current;
    items.forEach((n) => seen.add(n.id));
    writeSeen(id, seen);
    setItems((cur) => cur.map((n) => ({ ...n, read: true })));
  }, [items, user]);

  const dismiss = useCallback((notifId) => {
    setItems((cur) => cur.filter((n) => n.id !== notifId));
    if (user) {
      seenRef.current.add(notifId);
      writeSeen(user.id || user._id, seenRef.current);
    }
  }, [user]);

  const unread = items.reduce((sum, item) => sum + (item.read ? 0 : 1), 0);
  return { items, unread, refresh, markAllRead, dismiss };
}

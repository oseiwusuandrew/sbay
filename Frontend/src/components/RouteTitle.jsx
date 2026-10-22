import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SITE = 'sBay';
const HOME_TITLE = 'sBay: buy and sell on campus in Ghana';

// First match wins. Pages showing one listing or shop set a more specific
// title themselves with usePageTitle().
const TITLES = [
  [/^\/home$/, null],
  [/^\/search/, 'Search'],
  [/^\/categor/, 'Categories'],
  [/^\/trending/, 'Trending'],
  [/^\/cart/, 'Cart'],
  [/^\/checkout/, 'Checkout'],
  [/^\/payment-/, 'Payment'],
  [/^\/login/, 'Sign in'],
  [/^\/signup/, 'Create an account'],
  [/^\/forgot-password/, 'Reset password'],
  [/^\/chats?/, 'Messages'],
  [/^\/notifications/, 'Notifications'],
  [/^\/profile\/orders/, 'My orders'],
  [/^\/profile\/wishlist/, 'Saved items'],
  [/^\/profile\/settings/, 'Settings'],
  [/^\/profile/, 'My account'],
  [/^\/become-seller/, 'Start selling'],
  [/^\/sell$/, 'Sell an item'],
  [/^\/seller\/listing\//, 'Edit listing'],
  [/^\/seller-dashboard\/listings/, 'My listings'],
  [/^\/seller-dashboard\/sales/, 'Incoming orders'],
  [/^\/seller-dashboard/, 'Seller dashboard'],
  [/^\/seller\/subscription/, 'Seller plans'],
  [/^\/seller\/settings/, 'Shop settings'],
  [/^\/seller\/verification/, 'Verification'],
  [/^\/help/, 'Help'],
  [/^\/terms/, 'Terms'],
  [/^\/privacy/, 'Privacy'],
  [/^\/admin/, 'Admin'],
];

const formatTitle = (page) => (page ? `${page} · ${SITE}` : HOME_TITLE);

/** Sets document.title from the current route. Mounted once in App. */
export default function RouteTitle() {
  const { pathname } = useLocation();
  useEffect(() => {
    const match = TITLES.find(([rx]) => rx.test(pathname));
    if (match) document.title = formatTitle(match[1]);
  }, [pathname]);
  return null;
}

/** For pages whose title depends on what they show (a listing, a shop). */
// eslint-disable-next-line react-refresh/only-export-components
export function usePageTitle(page) {
  useEffect(() => {
    if (page) document.title = formatTitle(page);
  }, [page]);
}

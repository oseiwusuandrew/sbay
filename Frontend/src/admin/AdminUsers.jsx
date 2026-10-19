import { useSearchParams } from 'react-router-dom';
import AdminUserList from './AdminUserList';

/**
 * The "All users" page. Shares the search/filter table with the
 * role-specific pages (Buyers / Sellers / Admins) for consistency.
 *
 * The optional `?q=` query is honored so that the global search
 * bar in the top header can deep-link straight into a filtered list.
 */
export default function AdminUsers() {
  const [params] = useSearchParams();
  return (
    <AdminUserList
      title="All users"
      description="Everyone with an sBay account, sorted by most recent registration."
      initialQuery={params.get('q') || ''}
      initialRestricted={params.get('restricted') || ''}
      allowDelete
    />
  );
}

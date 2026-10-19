import { useSearchParams } from 'react-router-dom';
import AdminUserList from './AdminUserList';

/**
 * Seller verification queue — re-uses the user list with a fixed
 * filter that only shows sellers awaiting review. Admins approve or
 * reject from the inline action buttons.
 */
export default function AdminSellerVerification() {
  const [params] = useSearchParams();
  return (
    <AdminUserList
      fixedRole="seller"
      title="Seller verification"
      description="Sellers waiting for review. Approve to give them the verified badge across the marketplace, or reject with a reason they'll see in their seller settings."
      showRoleFilter={false}
      verificationStatus="pending"
      initialQuery={params.get('q') || ''}
    />
  );
}

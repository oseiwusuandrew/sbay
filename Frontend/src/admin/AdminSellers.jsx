import AdminUserList from './AdminUserList';

export default function AdminSellers() {
  return (
    <AdminUserList
      fixedRole="seller"
      title="Sellers"
      description="Sellers are users who have applied to list products. Click any row to open the deep-dive: listings, sales, buyers, conversations."
      showRoleFilter={false}
      allowDelete
    />
  );
}

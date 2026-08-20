import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin } from '../utils/roles';

function AdminRoute({ children }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  // Only CCAT admin-type roles can access the admin panel
  if (!isAdmin(user.role)) {
    return <Navigate to="/tourist" replace />;
  }
  return children;
}

export default AdminRoute;

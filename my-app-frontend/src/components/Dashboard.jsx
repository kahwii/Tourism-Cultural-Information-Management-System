import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isEstablishment } from '../utils/roles';

export default function Dashboard() {
  const { user } = useAuth();

  // Route each account type to its area
  if (isAdmin(user?.role)) {
    return <Navigate to="/admin" replace />;
  }
  if (isEstablishment(user?.role)) {
    return <Navigate to="/establishment" replace />;
  }
  // Tourists (and other non-admin accounts) go to Be@Mandaluyong
  return <Navigate to="/tourist" replace />;
}

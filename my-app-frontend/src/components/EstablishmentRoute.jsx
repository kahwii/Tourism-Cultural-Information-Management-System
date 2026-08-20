import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isEstablishment } from '../utils/roles';

// Guards the establishment accreditation portal.
function EstablishmentRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (isAdmin(user.role)) return <Navigate to="/admin" replace />;
  // only establishment accounts belong here; tourists go to Be@Mandaluyong
  if (!isEstablishment(user.role)) return <Navigate to="/tourist" replace />;

  return children;
}

export default EstablishmentRoute;

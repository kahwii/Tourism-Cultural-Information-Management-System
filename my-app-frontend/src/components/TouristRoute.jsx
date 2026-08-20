import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { isAdmin, isEstablishment } from '../utils/roles';

// Guards the tourist-facing Be@Mandaluyong area.
function TouristRoute({ children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  // admins shouldn't land in the tourist app
  if (isAdmin(user.role)) return <Navigate to="/admin" replace />;
  // establishments have their own portal
  if (isEstablishment(user.role)) return <Navigate to="/establishment" replace />;

  return children;
}

export default TouristRoute;

import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Profile() {
  const { user, logout } = useAuth();

  return (
    <div className="dashboard-page">
      <div className="dashboard-navbar">
        <div className="brand">My App</div>
        <nav>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/profile">Profile</Link>
          <button className="btn-logout" onClick={logout}>Logout</button>
        </nav>
      </div>

      <div className="dashboard-content">
        <h2>Profile</h2>
        <p>Your account information.</p>

        <div className="info-card">
          <div className="info-row">
            <span className="info-label">Username</span>
            <span className="info-value">{user.username}</span>
          </div>
          <div className="info-row">
            <span className="info-label">User ID</span>
            <span className="info-value">{user.id}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Profile;
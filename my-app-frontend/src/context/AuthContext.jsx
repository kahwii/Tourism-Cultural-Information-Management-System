import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { toast } from '../utils/toast';
import { apiLogout } from '../api/api';

const AuthContext = createContext(null);

const SESSION_TIMEOUT = 15 * 60 * 1000; // 15 minutes

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const stored = localStorage.getItem('user');
    return stored ? JSON.parse(stored) : null;
  });

  const timeoutRef = useRef(null);

  const login = (userData) => {
    setUser(userData);
    localStorage.setItem('user', JSON.stringify(userData));
    localStorage.setItem('loginTime', Date.now().toString());
  };

  const logout = () => {
    // Best-effort, fire-and-forget: clears api_token server-side too, so a
    // copied token can't keep working after the user has explicitly signed
    // out. Called before the localStorage entries below are removed, since
    // it needs to read the current token from them.
    apiLogout();
    setUser(null);
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
  };

  // Reset the inactivity timer every time the user does something
  const resetTimer = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (user) {
      timeoutRef.current = setTimeout(() => {
        logout();
        toast.info('Session expired due to inactivity. Please log in again.');
      }, SESSION_TIMEOUT);
    }
  };

  useEffect(() => {
    if (!user) return;

    resetTimer();

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach((event) => window.addEventListener(event, resetTimer));

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
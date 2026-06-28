import { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import API, { setUnauthorizedHandler, resetUnauthorizedGuard, setCsrfToken, clearCsrfToken } from '../api';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate              = useNavigate();
  const showToast             = useToast();

  useEffect(() => {
    setUnauthorizedHandler((message) => {
      setUser(null);
      showToast(message || 'Unauthorized. Please sign in again.', 'error');
      navigate('/', { replace: true });
    });
    return () => setUnauthorizedHandler(null);
  }, [navigate, showToast]);

  useEffect(() => {
    API.get('/api/me').then(data => {
      if (data.success) {
        setUser(data.user);
        setCsrfToken(data.csrfToken);
      }
    }).finally(() => setLoading(false));
  }, []);

  const login = (userData) => {
    resetUnauthorizedGuard();
    setUser(userData);
  };

  const logout = async () => {
    await API.post('/api/logout', {});
    clearCsrfToken();
    setUser(null);
    resetUnauthorizedGuard();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { authAPI, setUnauthorizedHandler } from '../services/api';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

const clearStoredSession = () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
};

// Readable message for failures that never reached the API (wrong API URL, CORS, server down)
const getErrorMessage = (error, fallback) => {
  if (error.response) {
    return error.response.data?.error || fallback;
  }
  return 'Cannot reach the server. Please check your connection and try again.';
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // An expired/invalid token detected anywhere in the app resets state here
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    return () => setUnauthorizedHandler(null);
  }, []);

  // Restore the session on mount, then confirm the token with the server
  useEffect(() => {
    let cancelled = false;

    const restoreSession = async () => {
      const storedToken = localStorage.getItem('token');
      let storedUser = null;
      try {
        storedUser = JSON.parse(localStorage.getItem('user'));
      } catch {
        storedUser = null; // corrupted value must not crash the app
      }

      if (!storedToken || !storedUser) {
        clearStoredSession();
        if (!cancelled) setLoading(false);
        return;
      }

      // Show the stored user immediately...
      if (!cancelled) setUser(storedUser);

      // ...then verify the token (expired / account deleted / secret rotated)
      try {
        const data = await authAPI.me();
        if (cancelled) return;
        localStorage.setItem('user', JSON.stringify(data.user));
        setUser(data.user);
      } catch (error) {
        if (cancelled) return;
        if (error.response && (error.response.status === 401 || error.response.status === 404)) {
          clearStoredSession();
          setUser(null);
        }
        // Network error: keep the stored session; the next API call will re-check it
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    restoreSession();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (credentials) => {
    try {
      const response = await authAPI.login(credentials);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, 'Login failed')
      };
    }
  };

  const register = async (userData) => {
    try {
      const response = await authAPI.register(userData);
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: getErrorMessage(error, 'Registration failed')
      };
    }
  };

  const logout = useCallback(() => {
    const token = localStorage.getItem('token');
    clearStoredSession();
    setUser(null);
    // Best effort: tell the server so isOnline becomes false. Failure must not block logout.
    if (token) {
      authAPI.logout(token).catch(() => {});
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

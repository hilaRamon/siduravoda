import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import { base44, getAuthToken, setAuthToken } from '@/api/base44Client';
import { isPublicPath } from '@/lib/publicRoutes';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkUserAuth = useCallback(async () => {
    if (isPublicPath(window.location.pathname)) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    setIsLoadingAuth(true);
    setAuthError(null);

    if (!getAuthToken()) {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required' });
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);
      setIsAuthenticated(true);
      setAuthError(null);
    } catch (error) {
      setAuthToken(null);
      setUser(null);
      setIsAuthenticated(false);
      if (error?.status === 401) {
        setAuthError({ type: 'auth_required' });
      } else {
        setAuthError({
          type: 'auth_error',
          message: error?.message || 'Authentication failed',
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkUserAuth();
  }, [checkUserAuth]);

  const login = useCallback(async (email, password) => {
    const loggedInUser = await base44.auth.login(email, password);
    setUser(loggedInUser);
    setIsAuthenticated(true);
    setAuthError(null);
    setIsLoadingAuth(false);
    setAuthChecked(true);
    return loggedInUser;
  }, []);

  const logout = useCallback(async () => {
    try {
      await base44.auth.logout();
    } finally {
      setUser(null);
      setIsAuthenticated(false);
      setAuthError({ type: 'auth_required' });
      setAuthChecked(true);
    }
  }, []);

  const navigateToLogin = useCallback(() => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings: false,
        authError,
        authChecked,
        appPublicSettings: { auth_required: true },
        logout,
        login,
        navigateToLogin,
        checkUserAuth,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

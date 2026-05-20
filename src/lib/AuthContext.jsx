import React, { createContext, useState, useContext, useEffect } from 'react';
import { base44 } from '@/api/base44Client';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(true);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [appPublicSettings, setAppPublicSettings] = useState({ auth_required: false });

  useEffect(() => {
    checkAppState();
  }, []);

  const checkAppState = async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);
    setAppPublicSettings({ auth_required: false });
    setIsLoadingPublicSettings(false);
    await checkUserAuth();
  };

  const checkUserAuth = async () => {
    setIsLoadingAuth(true);
    setUser(null);
    setAuthError(null);

    try {
      const user = await base44.auth.me();
      setUser(user);
      setIsAuthenticated(true);
    } catch (error) {
      // `request()` in `base44Client` throws an error with { status, data }.
      const status = error?.status;
      if (status === 401) {
        setIsAuthenticated(false);
        setAuthError({ type: 'auth_required' });
      } else {
        setIsAuthenticated(false);
        setAuthError({
          type: 'auth_error',
          message: error?.message || 'Authentication failed',
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  };

  const logout = (_shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    setAuthError(null);
    setAuthChecked(true);
    // No backend logout endpoint yet; we still update local auth state.
    base44.auth.logout?.();
  };

  const navigateToLogin = () => {
    // In the real Base44 integration, this should redirect to the Base44 auth flow.
    // For now we use the configured app base URL when available.
    const base44AppBaseUrl = import.meta?.env?.VITE_BASE44_APP_BASE_URL;
    if (base44AppBaseUrl) {
      window.location.href = base44AppBaseUrl;
      return;
    }
    window.location.href = '/';
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      isAuthenticated, 
      isLoadingAuth,
      isLoadingPublicSettings,
      authError,
      appPublicSettings,
      authChecked,
      logout,
      navigateToLogin,
      checkUserAuth,
      checkAppState
    }}>
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

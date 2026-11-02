import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth, EXPLICIT_LOGOUT_KEY } from '@/lib/AuthContext';
import { authApi } from '@/api/authApi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Loader2, LogIn, ChevronsUpDown, Check } from 'lucide-react';
import { PasswordField } from '@/components/ui/password-field';
import { isReporterOnly, isWorkplaceManagerOnly } from '@/lib/permissions';
import { cn } from '@/lib/utils';

function getPostLoginTarget(user, from) {
  if (isWorkplaceManagerOnly(user)) return '/workplaces';
  if (isReporterOnly(user)) return '/time-reporting';
  return from;
}

const GOOGLE_USER_NOT_FOUND =
  'לא נמצא משתמש עם כתובת האימייל הזו. ההתחברות עם Google אפשרית רק למשתמשים קיימים.';

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Google script failed')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Google script failed'));
    document.head.appendChild(script);
  });
}

export default function Login() {
  const {
    login,
    autoLogin,
    loginWithGoogle,
    resumeRememberedSession,
    isAuthenticated,
    user,
    isLoadingAuth,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [emails, setEmails] = useState([]);
  const [emailsLoading, setEmailsLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [emailOpen, setEmailOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [needsPassword, setNeedsPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingRemember, setCheckingRemember] = useState(false);
  const [resumingSession, setResumingSession] = useState(() => {
    if (sessionStorage.getItem(EXPLICIT_LOGOUT_KEY) === '1') {
      sessionStorage.removeItem(EXPLICIT_LOGOUT_KEY);
      return false;
    }
    return true;
  });
  const [googleClientId, setGoogleClientId] = useState('');
  const [googleLoading, setGoogleLoading] = useState(false);
  const googleBtnRef = useRef(null);
  const rememberMeRef = useRef(rememberMe);
  const from =
    (typeof location.state?.from === 'string' ? location.state.from : null) ||
    location.state?.from?.pathname ||
    '/';
  const fromRef = useRef(from);
  rememberMeRef.current = rememberMe;
  fromRef.current = from;

  useEffect(() => {
    if (!resumingSession) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const loggedIn = await resumeRememberedSession();
        if (!cancelled) {
          navigate(getPostLoginTarget(loggedIn, fromRef.current), { replace: true });
        }
      } catch {
        if (!cancelled) setResumingSession(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumingSession, resumeRememberedSession, navigate]);

  useEffect(() => {
    if (resumingSession) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const data = await authApi.googleClientId();
        if (!cancelled) setGoogleClientId(data?.clientId || '');
      } catch {
        if (!cancelled) setGoogleClientId('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resumingSession]);

  const handleGoogleCredential = useCallback(async (response) => {
    const credential = response?.credential;
    if (!credential) return;
    setError('');
    setGoogleLoading(true);
    try {
      const loggedIn = await loginWithGoogle(credential, rememberMeRef.current);
      navigate(getPostLoginTarget(loggedIn, fromRef.current), { replace: true });
    } catch (err) {
      if (err?.data?.code === 'google_user_not_found') {
        setError(GOOGLE_USER_NOT_FOUND);
      } else {
        setError(err?.message || 'התחברות עם Google נכשלה');
      }
    } finally {
      setGoogleLoading(false);
    }
  }, [loginWithGoogle, navigate]);

  useEffect(() => {
    if (!googleClientId || resumingSession) return undefined;
    let cancelled = false;

    (async () => {
      try {
        await loadGoogleIdentityScript();
      } catch {
        return;
      }
      if (cancelled || !googleBtnRef.current || !window.google?.accounts?.id) return;
      window.google.accounts.id.initialize({
        client_id: googleClientId,
        callback: (response) => {
          handleGoogleCredential(response);
        },
        auto_select: false,
      });
      googleBtnRef.current.replaceChildren();
      const width = Math.floor(googleBtnRef.current.offsetWidth) || 360;
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        type: 'standard',
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular',
        width,
        locale: 'he',
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [googleClientId, resumingSession, handleGoogleCredential]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await authApi.listLoginEmails();
        if (!cancelled) setEmails(Array.isArray(list) ? list : []);
      } catch {
        if (!cancelled) setEmails([]);
      } finally {
        if (!cancelled) setEmailsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && user) {
      navigate(getPostLoginTarget(user, from), { replace: true });
    }
  }, [isLoadingAuth, isAuthenticated, user, from, navigate]);

  const filteredEmails = useMemo(() => {
    const q = email.trim().toLowerCase();
    if (!q) return emails;
    return emails.filter((e) => e.includes(q));
  }, [emails, email]);

  const tryAutoLogin = useCallback(
    async (selectedEmail) => {
      const normalized = selectedEmail.trim().toLowerCase();
      if (!normalized) return;

      setError('');
      setCheckingRemember(true);
      setNeedsPassword(false);
      setPassword('');

      try {
        const loggedIn = await autoLogin(normalized);
        navigate(getPostLoginTarget(loggedIn, from), { replace: true });
      } catch (err) {
        if (err?.data?.code === 'not_remembered' || err?.status === 401) {
          setNeedsPassword(true);
        } else {
          setError(err?.message || 'התחברות נכשלה');
          setNeedsPassword(true);
        }
      } finally {
        setCheckingRemember(false);
      }
    },
    [autoLogin, from, navigate],
  );

  const handleSelectEmail = (selected) => {
    setEmail(selected);
    setEmailOpen(false);
    tryAutoLogin(selected);
  };

  const handleEmailConfirm = (e) => {
    e.preventDefault();
    if (needsPassword) return;
    const normalized = email.trim().toLowerCase();
    if (!normalized) {
      setError('נא לבחור או להזין אימייל');
      return;
    }
    setEmail(normalized);
    tryAutoLogin(normalized);
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedIn = await login(email.trim().toLowerCase(), password, rememberMe);
      navigate(getPostLoginTarget(loggedIn, from), { replace: true });
    } catch (err) {
      setError(err?.message || 'התחברות נכשלה');
    } finally {
      setLoading(false);
    }
  };

  if (isLoadingAuth || resumingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAuthenticated && user) {
    return <Navigate to={getPostLoginTarget(user, from)} replace />;
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-primary/30 p-6"
      dir="rtl"
    >
      <div className="w-full max-w-md bg-card rounded-2xl shadow-xl border border-border p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold">מערכת שיבוצים</h1>
          <p className="text-muted-foreground text-sm mt-2">התחברות למערכת</p>
        </div>

        <form
          onSubmit={needsPassword ? handlePasswordSubmit : handleEmailConfirm}
          className="space-y-4"
        >
          <div>
            <label className="text-sm font-medium mb-1.5 block">אימייל</label>
            <Popover open={emailOpen} onOpenChange={setEmailOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={emailOpen}
                  disabled={emailsLoading || checkingRemember || loading || googleLoading}
                  className="w-full justify-between font-normal"
                  dir="ltr"
                >
                  <span className={cn('truncate', !email && 'text-muted-foreground')}>
                    {email || 'בחר או חפש אימייל...'}
                  </span>
                  <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                <Command shouldFilter={false}>
                  <div className="border-b px-3 py-2">
                    <Input
                      type="email"
                      autoComplete="username"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        setNeedsPassword(false);
                        setPassword('');
                        setError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          setEmailOpen(false);
                          const normalized = email.trim().toLowerCase();
                          if (normalized) {
                            setEmail(normalized);
                            tryAutoLogin(normalized);
                          }
                        }
                      }}
                      placeholder="name@example.com"
                      dir="ltr"
                      className="h-9"
                      autoFocus
                    />
                  </div>
                  <CommandList>
                    <CommandEmpty>לא נמצאו משתמשים</CommandEmpty>
                    <CommandGroup>
                      {filteredEmails.map((item) => (
                        <CommandItem
                          key={item}
                          value={item}
                          dir="ltr"
                          onSelect={() => handleSelectEmail(item)}
                        >
                          <Check
                            className={cn(
                              'me-2 h-4 w-4',
                              email === item ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          {item}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {checkingRemember && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 size={16} className="animate-spin" />
              בודק התחברות שמורה...
            </div>
          )}

          {needsPassword && !checkingRemember && (
            <div>
              <label className="text-sm font-medium mb-1.5 block">סיסמה</label>
              <PasswordField
                id="login-password"
                value={password}
                onValueChange={setPassword}
                autoComplete="current-password"
                required
                showLengthValidation
                autoFocus
              />
            </div>
          )}

          {!checkingRemember && (
            <div className="flex items-center gap-2">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="remember-me" className="text-sm font-normal cursor-pointer">
                זכור אותי במחשב זה
              </Label>
            </div>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {!checkingRemember && (
            <Button type="submit" className="w-full" disabled={loading || emailsLoading || googleLoading}>
              {loading ? (
                <Loader2 size={18} className="animate-spin ml-2" />
              ) : (
                <LogIn className="ml-2" size={18} />
              )}
              {needsPassword ? 'התחבר' : 'המשך'}
            </Button>
          )}
        </form>

        {googleClientId && (
          <div className="mt-6">
            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs">
                <span className="bg-card px-2 text-muted-foreground">או</span>
              </div>
            </div>
            <div className="relative">
              <div ref={googleBtnRef} className="flex w-full justify-center min-h-10" />
              {googleLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-card/70">
                  <Loader2 size={18} className="animate-spin" />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

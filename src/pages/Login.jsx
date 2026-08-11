import { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { base44 } from '@/api/base44Client';
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

export default function Login() {
  const { login, autoLogin, isAuthenticated, user, isLoadingAuth } = useAuth();
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

  const from =
    (typeof location.state?.from === 'string' ? location.state.from : null) ||
    location.state?.from?.pathname ||
    '/';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await base44.auth.listLoginEmails();
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

  if (isLoadingAuth) {
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
                  disabled={emailsLoading || checkingRemember || loading}
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
            <>
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
            </>
          )}

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          {!checkingRemember && (
            <Button type="submit" className="w-full" disabled={loading || emailsLoading}>
              {loading ? (
                <Loader2 size={18} className="animate-spin ml-2" />
              ) : (
                <LogIn className="ml-2" size={18} />
              )}
              {needsPassword ? 'התחבר' : 'המשך'}
            </Button>
          )}
        </form>
      </div>
    </div>
  );
}

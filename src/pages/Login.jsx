import { useState, useEffect } from 'react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, LogIn } from 'lucide-react';
import { PasswordField } from '@/components/ui/password-field';
import { canReportTime, isWorkplaceManagerOnly } from '@/lib/permissions';

function getPostLoginTarget(user, from) {
  if (isWorkplaceManagerOnly(user)) return '/workplaces';
  if (canReportTime(user) && user.role !== 'admin') return '/time-reporting';
  return from;
}

export default function Login() {
  const { login, isAuthenticated, user, isLoadingAuth } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const from =
    (typeof location.state?.from === 'string' ? location.state.from : null) ||
    location.state?.from?.pathname ||
    '/';

  useEffect(() => {
    if (!isLoadingAuth && isAuthenticated && user) {
      navigate(getPostLoginTarget(user, from), { replace: true });
    }
  }, [isLoadingAuth, isAuthenticated, user, from, navigate]);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const loggedIn = await login(email.trim(), password);
      const target =
        canReportTime(loggedIn) && loggedIn.role !== 'admin'
          ? '/time-reporting'
          : from;
      navigate(target, { replace: true });
    } catch (err) {
      setError(err?.message || 'התחברות נכשלה');
    } finally {
      setLoading(false);
    }
  };

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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-1.5 block">אימייל</label>
            <Input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              dir="ltr"
              required
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1.5 block">סיסמה</label>
            <PasswordField
              id="login-password"
              value={password}
              onValueChange={setPassword}
              autoComplete="current-password"
              required
              showLengthValidation
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? (
              <Loader2 size={18} className="animate-spin ml-2" />
            ) : (
              <LogIn size={18} className="ml-2" />
            )}
            התחבר
          </Button>
        </form>
      </div>
    </div>
  );
}

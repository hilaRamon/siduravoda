import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Shield, UserCheck, Loader2, Trash2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin, isRegularUser } from '@/lib/permissions';

function getUserLevel(u) {
  if (u.role === 'admin') return 'admin';
  if (u.can_report_time) return 'reporter';
  if (u.can_manage_workplaces) return 'workplace_manager';
  return 'user';
}

// Levels available to admin (cannot create another admin)
const ADMIN_LEVELS = [
  {
    value: 'user',
    label: 'משתמש',
    description: 'גישה בסיסית למערכת',
    color: 'bg-secondary text-secondary-foreground border-border',
    activeColor: 'bg-slate-600 text-white border-slate-600',
  },
  {
    value: 'reporter',
    label: 'דיווח זמנים',
    description: 'גישה לקישור דיווח הזמנים בלבד',
    color: 'bg-blue-50 text-blue-700 border-blue-200',
    activeColor: 'bg-blue-600 text-white border-blue-600',
  },
  {
    value: 'workplace_manager',
    label: 'מקומות עבודה',
    description: 'גישה לעמוד מקומות עבודה בלבד',
    color: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    activeColor: 'bg-emerald-600 text-white border-emerald-600',
  },
];

// ─── Invite box (shared) ──────────────────────────────────────────────────────

function InviteBox({ allowedLevel, label }) {
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleInvite = async () => {
    if (!email.trim()) return;
    setInviting(true);
    setResult(null);
    setError('');
    try {
      const res = await base44.auth.inviteUser(email.trim(), allowedLevel, fullName.trim());
      setResult({ email: email.trim(), password: res.temporaryPassword });
      setEmail('');
      setFullName('');
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    } catch (err) {
      setError(err?.message || 'שגיאה ביצירת המשתמש');
    } finally {
      setInviting(false);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl p-5">
      <h3 className="font-semibold mb-3 flex items-center gap-2">
        <UserCheck size={16} className="text-primary" /> {label}
      </h3>

      {result ? (
        <div className="p-3 bg-primary/10 rounded-lg text-sm border border-primary/20">
          <p className="font-medium">משתמש נוצר בהצלחה</p>
          <p className="text-muted-foreground mt-1" dir="ltr">{result.email}</p>
          <p className="mt-2">
            סיסמה זמנית:{' '}
            <code className="bg-secondary px-2 py-0.5 rounded font-mono" dir="ltr">
              {result.password}
            </code>
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            העבר את הסיסמה למשתמש — לא תוצג שוב.
          </p>
          <Button className="mt-4" onClick={() => setResult(null)}>
            הבנתי
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            <Input
              placeholder="שם מלא (אופציונלי)"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
            />
            <div className="flex gap-2">
              <Input
                placeholder="כתובת אימייל..."
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleInvite()}
                className="flex-1"
                dir="ltr"
              />
              <Button onClick={handleInvite} disabled={inviting || !email.trim()}>
                {inviting ? <Loader2 size={15} className="animate-spin" /> : 'הוסף'}
              </Button>
            </div>
          </div>

          {error && (
            <p className="mt-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// ─── Admin view ───────────────────────────────────────────────────────────────

function UserManager({ canManageUsers, inviteOptions }) {
  const queryClient = useQueryClient();
  const [updating, setUpdating] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.auth.listUsers(),
    enabled: canManageUsers,
  });

  const manageableUsers = users;

  const levelButtons =
    inviteOptions.includes('user')
      ? ADMIN_LEVELS
      : ADMIN_LEVELS.filter((l) => inviteOptions.includes(l.value));

  const handleSetLevel = async (user, level) => {
    setUpdating(user.id);
    try {
      await base44.auth.updateUser(user.id, { level });
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    } finally {
      setUpdating(null);
    }
  };

  const handleDelete = async (user) => {
    if (!window.confirm(`למחוק את המשתמש ${user.email}?`)) return;
    setDeleting(user.id);
    try {
      await base44.auth.deleteUser(user.id);
      queryClient.invalidateQueries({ queryKey: ['users-list'] });
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="space-y-5 max-w-3xl">
      {inviteOptions.includes('user') && (
        <InviteBox allowedLevel="user" label="הוספת משתמש רגיל" />
      )}
      {inviteOptions.includes('reporter') && (
        <InviteBox allowedLevel="reporter" label="הוספת מדווח זמנים" />
      )}
      {inviteOptions.includes('workplace_manager') && (
        <InviteBox allowedLevel="workplace_manager" label="הוספת מנהל מקומות עבודה" />
      )}

      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          <h3 className="font-semibold">ניהול הרשאות משתמשים</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
            {manageableUsers.length} משתמשים
          </span>
        </div>

        <div className="px-5 py-3 bg-secondary/30 border-b border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
          {levelButtons.map(l => (
            <span key={l.value} className="flex items-center gap-1.5">
              <span className={`inline-block w-2.5 h-2.5 rounded-full ${l.activeColor.split(' ')[0]}`} />
              <strong>{l.label}</strong> — {l.description}
            </span>
          ))}
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground">
            <Loader2 size={20} className="animate-spin mx-auto" />
          </div>
        ) : manageableUsers.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">אין משתמשים לניהול</div>
        ) : (
          <div className="divide-y divide-border">
            {manageableUsers.map(u => {
              const isUpdating = updating === u.id;
              const isDeleting = deleting === u.id;
              const currentLevel = getUserLevel(u);

              return (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4 flex-wrap hover:bg-secondary/10 transition-colors">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium">{u.full_name || '—'}</div>
                    <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{u.email}</div>
                  </div>

                  {isUpdating || isDeleting ? (
                    <Loader2 size={16} className="animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex gap-1.5">
                        {levelButtons.map(level => {
                          const isActive = currentLevel === level.value;
                          return (
                            <button
                              key={level.value}
                              disabled={isActive}
                              onClick={() => handleSetLevel(u, level.value)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                                ${isActive
                                  ? level.activeColor + ' cursor-default'
                                  : level.color + ' hover:opacity-80 cursor-pointer'}
                              `}
                              title={level.description}
                            >
                              {level.label}
                            </button>
                          );
                        })}
                      </div>
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                        title="מחק משתמש"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function UserPermissions() {
  const { user } = useAuth();
  const admin = isAdmin(user);
  const canManageUsers = admin || isRegularUser(user);
  const inviteOptions = admin
    ? ['user', 'reporter', 'workplace_manager']
    : ['reporter', 'workplace_manager'];

  if (!canManageUsers) return null;

  return (
    <UserManager canManageUsers={canManageUsers} inviteOptions={inviteOptions} />
  );
}

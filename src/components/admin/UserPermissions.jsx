import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Shield, UserCheck, Loader2, ExternalLink, Copy, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';

const TIME_REPORTING_URL = 'https://preview-sandbox--69e4a6cee7903b37397ae8fb.base44.app/time-reporting';

// Derive a simple "permission level" from user fields
function getUserLevel(u) {
  if (u.role === 'admin') return 'admin';
  if (u.can_report_time) return 'reporter';
  return 'user';
}

// Map level → what to save
function levelToFields(level) {
  switch (level) {
    case 'admin':    return { role: 'admin',  can_report_time: false, can_view_time_reports: false };
    case 'reporter': return { role: 'user',   can_report_time: true,  can_view_time_reports: false };
    default:         return { role: 'user',   can_report_time: false, can_view_time_reports: false };
  }
}

const LEVELS = [
  {
    value: 'admin',
    label: 'מנהל',
    description: 'גישה מלאה לכל המערכת',
    color: 'bg-purple-100 text-purple-700 border-purple-300',
    activeColor: 'bg-purple-600 text-white border-purple-600',
  },
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
];

export default function UserPermissions({ currentUser }) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [updating, setUpdating] = useState(null);
  const [copied, setCopied] = useState(false);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const isAdmin = currentUser?.role === 'admin';

  const handleSetLevel = async (user, level) => {
    setUpdating(user.id);
    await base44.entities.User.update(user.id, levelToFields(level));
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
    setUpdating(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    await base44.users.inviteUser(inviteEmail.trim(), 'user');
    setInviteEmail('');
    queryClient.invalidateQueries({ queryKey: ['users-list'] });
    setInviting(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(TIME_REPORTING_URL);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAdmin) {
    return (
      <div className="bg-card border border-border rounded-2xl p-8 text-center text-muted-foreground">
        <Shield size={32} className="mx-auto mb-3 opacity-30" />
        <p>רק מנהלים יכולים לנהל הרשאות משתמשים.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">

      {/* Invite */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <UserCheck size={16} className="text-primary" /> הזמנת משתמש חדש
        </h3>
        <div className="flex gap-2">
          <Input
            placeholder="כתובת אימייל..."
            value={inviteEmail}
            onChange={e => setInviteEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleInvite()}
            className="flex-1"
            dir="ltr"
          />
          <Button onClick={handleInvite} disabled={inviting || !inviteEmail.trim()}>
            {inviting ? <Loader2 size={15} className="animate-spin" /> : 'הזמן'}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-2">המשתמש יקבל אימייל הזמנה ויצטרך להירשם.</p>
      </div>

      {/* Time reporting link info */}
      <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-blue-800 mb-1">קישור דיווח זמנים</p>
          <p className="text-xs text-blue-600 truncate" dir="ltr">{TIME_REPORTING_URL}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 gap-1" onClick={handleCopy}>
            {copied ? <Check size={13} /> : <Copy size={13} />}
            {copied ? 'הועתק!' : 'העתק'}
          </Button>
          <a href={TIME_REPORTING_URL} target="_blank" rel="noreferrer">
            <Button size="sm" variant="outline" className="border-blue-300 text-blue-700 hover:bg-blue-100 gap-1">
              <ExternalLink size={13} /> פתח
            </Button>
          </a>
        </div>
      </div>

      {/* Users table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          <h3 className="font-semibold">ניהול הרשאות משתמשים</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{users.length} משתמשים</span>
        </div>

        {/* Legend */}
        <div className="px-5 py-3 bg-secondary/30 border-b border-border flex flex-wrap gap-4 text-xs text-muted-foreground">
          {LEVELS.map(l => (
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
        ) : (
          <div className="divide-y divide-border">
            {users.map(u => {
              const isSelf = u.id === currentUser?.id;
              const isUpdating = updating === u.id;
              const currentLevel = getUserLevel(u);

              return (
                <div key={u.id} className={`flex items-center gap-4 px-5 py-4 flex-wrap transition-colors ${isSelf ? 'bg-primary/5' : 'hover:bg-secondary/10'}`}>
                  {/* User info */}
                  <div className="min-w-0 flex-1">
                    <div className="font-medium flex items-center gap-2">
                      {u.full_name || '—'}
                      {isSelf && <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">את/ה</span>}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5" dir="ltr">{u.email}</div>
                  </div>

                  {/* Level selector */}
                  {isUpdating ? (
                    <Loader2 size={16} className="animate-spin text-muted-foreground shrink-0" />
                  ) : (
                    <div className="flex gap-1.5 flex-wrap">
                      {LEVELS.map(level => {
                        const isActive = currentLevel === level.value;
                        const disabled = isSelf && level.value !== 'admin';
                        return (
                          <button
                            key={level.value}
                            disabled={disabled || isActive}
                            onClick={() => handleSetLevel(u, level.value)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all
                              ${isActive
                                ? level.activeColor + ' cursor-default'
                                : level.color + ' hover:opacity-80 cursor-pointer'}
                              ${disabled ? 'opacity-40 cursor-not-allowed' : ''}
                            `}
                            title={disabled ? 'לא ניתן לשנות את ההרשאה שלך' : level.description}
                          >
                            {level.label}
                          </button>
                        );
                      })}
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
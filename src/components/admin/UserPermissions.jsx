import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Shield, Clock, UserX, UserCheck, Loader2 } from 'lucide-react';
import { Input } from '@/components/ui/input';

const ROLE_LABELS = { admin: 'מנהל', user: 'משתמש' };

export default function UserPermissions({ currentUser }) {
  const queryClient = useQueryClient();
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting] = useState(false);
  const [updating, setUpdating] = useState(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users-list'],
    queryFn: () => base44.entities.User.list(),
  });

  const isAdmin = currentUser?.role === 'admin';

  const handleUpdate = async (user, changes) => {
    setUpdating(user.id);
    await base44.entities.User.update(user.id, changes);
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
        <h3 className="font-semibold mb-3 flex items-center gap-2"><UserCheck size={16} className="text-primary" /> הזמנת משתמש חדש</h3>
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

      {/* Users table */}
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center gap-2">
          <Shield size={16} className="text-primary" />
          <h3 className="font-semibold">ניהול הרשאות משתמשים</h3>
          <span className="text-xs text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{users.length} משתמשים</span>
        </div>
        {isLoading ? (
          <div className="p-8 text-center text-muted-foreground"><Loader2 size={20} className="animate-spin mx-auto" /></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-secondary/50 border-b border-border">
              <tr>
                <th className="text-right px-5 py-3 font-semibold text-muted-foreground">משתמש</th>
                <th className="text-right px-4 py-3 font-semibold text-muted-foreground">תפקיד</th>
                <th className="text-center px-4 py-3 font-semibold text-muted-foreground">
                  <span className="flex items-center justify-center gap-1"><Clock size={13} /> דיווח זמנים</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {users.map(u => {
                const isSelf = u.id === currentUser?.id;
                const isUpdating = updating === u.id;
                return (
                  <tr key={u.id} className={`hover:bg-secondary/20 transition-colors ${isSelf ? 'bg-primary/5' : ''}`}>
                    <td className="px-5 py-3">
                      <div className="font-medium">{u.full_name || '—'}</div>
                      <div className="text-xs text-muted-foreground" dir="ltr">{u.email}</div>
                      {isSelf && <span className="text-xs text-primary font-medium">את/ה</span>}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role || 'user'}
                        disabled={isSelf || isUpdating}
                        onChange={e => handleUpdate(u, { role: e.target.value })}
                        className="border border-border rounded-md px-2 py-1 text-xs bg-card focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="admin">מנהל</option>
                        <option value="user">משתמש</option>
                      </select>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {isUpdating ? (
                        <Loader2 size={14} className="animate-spin mx-auto text-muted-foreground" />
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!u.can_report_time}
                          onChange={e => handleUpdate(u, { can_report_time: e.target.checked })}
                          className="w-4 h-4 accent-primary cursor-pointer"
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
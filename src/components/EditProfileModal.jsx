import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PasswordField } from '@/components/ui/password-field';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';

export default function EditProfileModal({ open, onClose }) {
  const { user, checkUserAuth } = useAuth();
  const queryClient = useQueryClient();

  const [name, setName] = useState(user?.full_name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [detailsLoading, setDetailsLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [detailsSuccess, setDetailsSuccess] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');

  const isEnvAdmin = user?.role === 'admin';

  useEffect(() => {
    if (!open || !user) return;
    setName(user.full_name || '');
    setEmail(user.email || '');
    setDetailsError('');
    setDetailsSuccess('');
    setPasswordError('');
    setPasswordSuccess('');
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  }, [open, user]);

  async function handleSaveDetails(e) {
    e.preventDefault();
    setDetailsError('');
    setDetailsSuccess('');
    setDetailsLoading(true);
    try {
      const previousEmail = user?.email?.trim().toLowerCase() || '';
      const nextEmail = email.trim().toLowerCase();
      const updated = await base44.auth.updateMe({
        full_name: name.trim(),
        email: nextEmail,
      });
      if (!updated?.id) {
        throw new Error('עדכון הפרטים נכשל');
      }
      await checkUserAuth();
      await queryClient.invalidateQueries({ queryKey: ['users-list'] });
      if (previousEmail && nextEmail !== previousEmail) {
        setDetailsSuccess(
          'הפרטים עודכנו. להתחברות הבאה השתמש בכתובת האימייל החדשה.',
        );
      } else {
        setDetailsSuccess('הפרטים עודכנו בהצלחה');
      }
    } catch (err) {
      setDetailsError(err.message || 'שגיאה בעדכון הפרטים');
    } finally {
      setDetailsLoading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSuccess('');
    if (newPassword !== confirmPassword) {
      setPasswordError('הסיסמאות אינן תואמות');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('הסיסמה חייבת להכיל לפחות 6 תווים');
      return;
    }
    setPasswordLoading(true);
    try {
      await base44.auth.changePassword(currentPassword, newPassword);
      setPasswordSuccess('הסיסמה עודכנה בהצלחה. בהתחברות הבאה השתמש בסיסמה החדשה.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordError(err.message || 'שגיאה בעדכון הסיסמה');
    } finally {
      setPasswordLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>עריכת פרופיל</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Personal Details */}
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">פרטים אישיים</h3>

            <div className="space-y-2">
              <Label htmlFor="profile-name">שם מלא</Label>
              <Input
                id="profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם מלא"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profile-email">דואר אלקטרוני</Label>
              <Input
                id="profile-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                disabled={isEnvAdmin}
              />
              {isEnvAdmin && (
                <p className="text-xs text-muted-foreground">כתובת האימייל של מנהל המערכת מנוהלת דרך הגדרות השרת</p>
              )}
            </div>

            {detailsError && <p className="text-sm text-destructive">{detailsError}</p>}
            {detailsSuccess && <p className="text-sm text-green-600">{detailsSuccess}</p>}

            <Button type="submit" disabled={detailsLoading} className="w-full">
              {detailsLoading ? 'שומר...' : 'שמור פרטים'}
            </Button>
          </form>

          <hr className="border-border" />

          {/* Password Change */}
          <form onSubmit={handleChangePassword} className="space-y-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">שינוי סיסמה</h3>

            {isEnvAdmin ? (
              <p className="text-sm text-muted-foreground">
                סיסמת מנהל המערכת מנוהלת דרך הגדרות השרת ולא ניתן לשנות אותה כאן.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="current-password">סיסמה נוכחית</Label>
                  <PasswordField
                    id="current-password"
                    value={currentPassword}
                    onValueChange={setCurrentPassword}
                    placeholder="סיסמה נוכחית"
                    autoComplete="current-password"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="new-password">סיסמה חדשה</Label>
                  <PasswordField
                    id="new-password"
                    value={newPassword}
                    onValueChange={setNewPassword}
                    placeholder="לפחות 6 תווים"
                    autoComplete="new-password"
                    showLengthValidation
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-password">אימות סיסמה חדשה</Label>
                  <PasswordField
                    id="confirm-password"
                    value={confirmPassword}
                    onValueChange={setConfirmPassword}
                    placeholder="חזור על הסיסמה החדשה"
                    autoComplete="new-password"
                    showLengthValidation
                  />
                </div>

                {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                {passwordSuccess && <p className="text-sm text-green-600">{passwordSuccess}</p>}

                <Button type="submit" variant="outline" disabled={passwordLoading} className="w-full">
                  {passwordLoading ? 'מעדכן...' : 'עדכן סיסמה'}
                </Button>
              </>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

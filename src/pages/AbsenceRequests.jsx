import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { MessageSquare, Check, X, Clock, RefreshCw } from 'lucide-react';

const STATUS_COLORS = {
  'ממתין': 'bg-warning/15 text-warning border-warning/30',
  'אושר': 'bg-success/15 text-success border-success/30',
  'נדחה': 'bg-destructive/15 text-destructive border-destructive/30',
};

const STATUS_ICONS = {
  'ממתין': <Clock size={12} />,
  'אושר': <Check size={12} />,
  'נדחה': <X size={12} />,
};

function RequestRow({ request, students, onUpdate }) {
  const [showDetail, setShowDetail] = useState(false);
  const [notes, setNotes] = useState(request.notes || '');
  const [linkedStudent, setLinkedStudent] = useState(request.student_id || '');
  const queryClient = useQueryClient();

  const handleStatusChange = async (status) => {
    await base44.entities.IncomingSMS.update(request.id, { status });
    queryClient.invalidateQueries({ queryKey: ['incoming-sms'] });
  };

  const handleSaveDetail = async () => {
    const student = students.find(s => s.id === linkedStudent);
    await base44.entities.IncomingSMS.update(request.id, {
      notes,
      student_id: linkedStudent || null,
      student_name: student?.full_name || null,
    });
    queryClient.invalidateQueries({ queryKey: ['incoming-sms'] });
    setShowDetail(false);
  };

  const displayName = request.student_name || request.parsed_student_name || '—';

  return (
    <>
      <tr
        className="hover:bg-secondary/20 cursor-pointer transition-colors"
        onClick={() => setShowDetail(true)}
      >
        <td className="px-4 py-3 border-b border-border">
          <div className="font-medium text-sm">{displayName}</div>
        </td>
        <td className="px-4 py-3 border-b border-border text-sm">
          {request.parsed_date
            ? new Date(request.parsed_date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: '2-digit' })
            : <span className="text-muted-foreground text-xs">לא זוהה</span>
          }
        </td>
        <td className="px-4 py-3 border-b border-border text-sm max-w-xs">
          <div className="truncate">{request.parsed_reason || <span className="text-muted-foreground text-xs">—</span>}</div>
        </td>
        <td className="px-4 py-3 border-b border-border text-xs text-muted-foreground">
          {request.sms_date || new Date(request.created_date).toLocaleString('he-IL')}
        </td>
        <td className="px-4 py-3 border-b border-border" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-1">
            <Badge className={`text-xs px-2 py-0.5 border flex items-center gap-1 ${STATUS_COLORS[request.status]}`}>
              {STATUS_ICONS[request.status]}
              {request.status}
            </Badge>
          </div>
        </td>
        <td className="px-4 py-3 border-b border-border" onClick={e => e.stopPropagation()}>
          <div className="flex gap-1">
            {request.status !== 'אושר' && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-success hover:bg-success/10"
                onClick={() => handleStatusChange('אושר')}>
                <Check size={13} />
              </Button>
            )}
            {request.status !== 'נדחה' && (
              <Button size="sm" variant="ghost" className="h-7 px-2 text-destructive hover:bg-destructive/10"
                onClick={() => handleStatusChange('נדחה')}>
                <X size={13} />
              </Button>
            )}
          </div>
        </td>
      </tr>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>פרטי בקשת היעדרות</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="bg-secondary/40 rounded-lg p-3 text-sm">
              <div className="text-xs text-muted-foreground mb-1">הודעה מקורית</div>
              <p className="font-medium">{request.message}</p>
              <div className="text-xs text-muted-foreground mt-2">מ: {request.phone} | {request.sms_date}</div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground mb-1">תאריך יעדרות (AI)</div>
                <div className="font-medium">{request.parsed_date || '—'}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground mb-1">סיבה (AI)</div>
                <div className="font-medium">{request.parsed_reason || '—'}</div>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">קישור לתלמיד</label>
              <Select value={linkedStudent} onValueChange={setLinkedStudent}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="— בחר תלמיד —" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— ללא קישור —</SelectItem>
                  {students.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">הערות</label>
              <Textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="הערות נוספות..."
                className="text-sm h-20"
              />
            </div>

            <div className="flex gap-2 justify-between pt-1">
              <div className="flex gap-1">
                <Button size="sm" className="bg-success hover:bg-success/90 text-white"
                  onClick={() => { handleStatusChange('אושר'); setShowDetail(false); }}>
                  <Check size={13} className="ml-1" /> אשר
                </Button>
                <Button size="sm" variant="destructive"
                  onClick={() => { handleStatusChange('נדחה'); setShowDetail(false); }}>
                  <X size={13} className="ml-1" /> דחה
                </Button>
              </div>
              <Button size="sm" onClick={handleSaveDetail}>שמור</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function AbsenceRequests() {
  const [filterStatus, setFilterStatus] = useState('all');
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['incoming-sms'],
    queryFn: () => base44.entities.IncomingSMS.list('-created_date', 500),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('full_name', 1000),
  });

  const filtered = useMemo(() => {
    if (filterStatus === 'all') return requests;
    return requests.filter(r => r.status === filterStatus);
  }, [requests, filterStatus]);

  const counts = useMemo(() => ({
    total: requests.length,
    pending: requests.filter(r => r.status === 'ממתין').length,
    approved: requests.filter(r => r.status === 'אושר').length,
    rejected: requests.filter(r => r.status === 'נדחה').length,
  }), [requests]);

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <MessageSquare size={24} className="text-primary" />
            בקשות היעדרות
          </h2>
          <p className="text-muted-foreground mt-1 text-sm">הודעות SMS נכנסות שנותחו אוטומטית</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ['incoming-sms'] })}>
          <RefreshCw size={14} className="ml-1" /> רענן
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: 'סה"כ', value: counts.total, color: 'text-foreground' },
          { label: 'ממתינות', value: counts.pending, color: 'text-warning' },
          { label: 'אושרו', value: counts.approved, color: 'text-success' },
          { label: 'נדחו', value: counts.rejected, color: 'text-destructive' },
        ].map(stat => (
          <div key={stat.label} className="bg-card border border-border rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-3 mb-4">
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">כל הבקשות</SelectItem>
            <SelectItem value="ממתין">ממתינות</SelectItem>
            <SelectItem value="אושר">אושרו</SelectItem>
            <SelectItem value="נדחה">נדחו</SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">{filtered.length} בקשות</span>
      </div>

      {/* Table */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 border-b border-border">
            <tr>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">שם תלמיד</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">תאריך היעדרות</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">סיבה</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">התקבל</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">סטטוס</th>
              <th className="px-4 py-3 text-right font-semibold text-muted-foreground text-xs">פעולות</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">טוען...</td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-center py-12 text-muted-foreground">
                  אין בקשות להצגה
                </td>
              </tr>
            ) : (
              filtered.map(req => (
                <RequestRow key={req.id} request={req} students={students} onUpdate={() => {}} />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
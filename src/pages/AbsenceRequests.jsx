import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
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

function RequestRow({ request, students, selected, onToggleSelect }) {
  const [showDetail, setShowDetail] = useState(false);
  const [notes, setNotes] = useState(request.notes || '');
  const [linkedStudent, setLinkedStudent] = useState(request.student_id || '');
  const queryClient = useQueryClient();

  const handleStatusChange = async (status) => {
    await base44.entities.IncomingSMS.update(request.id, { status });
    queryClient.invalidateQueries({ queryKey: ['incoming-sms'] });
    queryClient.invalidateQueries({ queryKey: ['incoming-sms-pending'] });
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
      <tr className={`hover:bg-secondary/20 transition-colors ${selected ? 'bg-primary/5' : ''}`}>
        <td className="px-3 py-3 border-b border-border" onClick={e => e.stopPropagation()}>
          <Checkbox checked={selected} onCheckedChange={() => onToggleSelect(request.id)} />
        </td>
        <td className="px-4 py-3 border-b border-border cursor-pointer" onClick={() => setShowDetail(true)}>
          <div className="font-medium text-sm">{displayName}</div>
        </td>
        <td className="px-4 py-3 border-b border-border text-sm cursor-pointer" onClick={() => setShowDetail(true)}>
          {request.parsed_date
            ? new Date(request.parsed_date + 'T12:00:00').toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric', year: '2-digit' })
            : <span className="text-muted-foreground text-xs">לא זוהה</span>
          }
        </td>
        <td className="px-4 py-3 border-b border-border text-sm max-w-xs cursor-pointer" onClick={() => setShowDetail(true)}>
          <div className="truncate">{request.parsed_reason || <span className="text-muted-foreground text-xs">—</span>}</div>
        </td>
        <td className="px-4 py-3 border-b border-border text-xs text-muted-foreground cursor-pointer" onClick={() => setShowDetail(true)}>
          {request.sms_date || new Date(request.created_date).toLocaleString('he-IL')}
        </td>
        <td className="px-4 py-3 border-b border-border" onClick={e => e.stopPropagation()}>
          <Badge className={`text-xs px-2 py-0.5 border flex items-center gap-1 w-fit ${STATUS_COLORS[request.status]}`}>
            {STATUS_ICONS[request.status]}
            {request.status}
          </Badge>
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
  const [activeTab, setActiveTab] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const queryClient = useQueryClient();

  const { data: requests = [], isLoading } = useQuery({
    queryKey: ['incoming-sms'],
    queryFn: () => base44.entities.IncomingSMS.list('-created_date', 500),
  });

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list('full_name', 1000),
  });

  const counts = useMemo(() => ({
    pending: requests.filter(r => r.status === 'ממתין').length,
    approved: requests.filter(r => r.status === 'אושר').length,
    rejected: requests.filter(r => r.status === 'נדחה').length,
  }), [requests]);

  const displayed = useMemo(() => {
    if (activeTab === null) return requests.filter(r => r.status === 'ממתין');
    return requests.filter(r => r.status === activeTab);
  }, [requests, activeTab]);

  const allSelected = displayed.length > 0 && displayed.every(r => selectedIds.has(r.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayed.map(r => r.id)));
    }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkStatus = async (status) => {
    setBulkProcessing(true);
    try {
      const ids = [...selectedIds];
      await Promise.all(ids.map(id => base44.entities.IncomingSMS.update(id, { status })));
      queryClient.invalidateQueries({ queryKey: ['incoming-sms'] });
      queryClient.invalidateQueries({ queryKey: ['incoming-sms-pending'] });
      setSelectedIds(new Set());
    } finally {
      setBulkProcessing(false);
    }
  };

  const statCards = [
    { label: 'ממתינות', value: counts.pending, color: 'text-warning', border: 'border-warning/40', bg: 'bg-warning/10', tab: null },
    { label: 'אושרו', value: counts.approved, color: 'text-success', border: 'border-success/40', bg: 'bg-success/10', tab: 'אושר' },
    { label: 'נדחו', value: counts.rejected, color: 'text-destructive', border: 'border-destructive/40', bg: 'bg-destructive/10', tab: 'נדחה' },
  ];

  const activeLabel = activeTab === null ? 'ממתינות' : activeTab === 'אושר' ? 'אושרו' : 'נדחו';

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

      {/* Stat Cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {statCards.map(stat => {
          const isActive = activeTab === stat.tab;
          return (
            <button
              key={stat.label}
              onClick={() => { setActiveTab(stat.tab); setSelectedIds(new Set()); }}
              className={`rounded-xl p-4 text-center border-2 transition-all duration-150 ${
                isActive
                  ? `${stat.bg} ${stat.border} shadow-sm`
                  : 'bg-card border-border hover:border-border/80 hover:bg-secondary/30'
              }`}
            >
              <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </button>
          );
        })}
      </div>

      {/* Table header + bulk actions */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{activeLabel}</span>
          <span className="text-sm text-muted-foreground">— {displayed.length} בקשות</span>
        </div>
        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-primary font-medium">{selectedIds.size} נבחרו</span>
            <Button size="sm" className="h-8 gap-1 bg-success hover:bg-success/90 text-white"
              onClick={() => handleBulkStatus('אושר')} disabled={bulkProcessing}>
              <Check size={13} /> אשר הכל
            </Button>
            <Button size="sm" variant="destructive" className="h-8 gap-1"
              onClick={() => handleBulkStatus('נדחה')} disabled={bulkProcessing}>
              <X size={13} /> דחה הכל
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-muted-foreground"
              onClick={() => setSelectedIds(new Set())}>
              ביטול
            </Button>
          </div>
        )}
      </div>

      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-secondary/60 border-b border-border">
            <tr>
              <th className="px-3 py-3 w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} />
              </th>
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
                <td colSpan={7} className="text-center py-12 text-muted-foreground">טוען...</td>
              </tr>
            ) : displayed.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-12 text-muted-foreground">
                  אין בקשות להצגה
                </td>
              </tr>
            ) : (
              displayed.map(req => (
                <RequestRow
                  key={req.id}
                  request={req}
                  students={students}
                  selected={selectedIds.has(req.id)}
                  onToggleSelect={toggleSelect}
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
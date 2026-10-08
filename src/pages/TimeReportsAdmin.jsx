import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { canApproveTimeReports } from '@/lib/permissions';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, Clock, CalendarDays, Building2, User, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { useAssignments } from '@/queries/assignmentQueries';
import {
  useBulkTimeReportStatus,
  usePendingTimeReports,
  useTimeReportsByDate,
} from '@/queries/timeReportQueries';
import {
  usePendingPieceworkQuantities,
  useUpdateWorkplaceLogistics,
} from '@/queries/workplaceLogisticsQueries';
import { useLogisticsByWorkplace } from '@/hooks/assignments/useLogisticsByWorkplace';
import UnitsQuantityInput from '@/components/timeReports/UnitsQuantityInput';

const DEFAULT_START = '07:00';
const DEFAULT_END = '11:45';

const STATUS_STYLES = {
  'ממתין': 'bg-yellow-100 text-yellow-700',
  'אושר': 'bg-green-100 text-green-700',
  'נדחה': 'bg-red-100 text-red-700',
};

function calcDuration(start, end) {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  const diff = (eh * 60 + em) - (sh * 60 + sm);
  if (diff <= 0) return null;
  return Math.round(diff / 60 * 100) / 100;
}

function ActionButtons({ report, onStatus, pending, pendingStatus }) {
  return (
    <div className="flex gap-1 justify-end">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50"
        onClick={() => onStatus(report, 'אושר')}
        disabled={pending || report.status === 'אושר'}
      >
        {pendingStatus === 'אושר' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} אשר
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 text-red-500 border-red-300 hover:bg-red-50"
        onClick={() => onStatus(report, 'נדחה')}
        disabled={pending || report.status === 'נדחה'}
      >
        {pendingStatus === 'נדחה' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} דחה
      </Button>
    </div>
  );
}

function QuantityActions({ onApprove, onReject, pending, pendingStatus, reportedUnits }) {
  const approveDisabled = pending || reportedUnits == null;
  return (
    <div className="flex gap-1">
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50"
        onClick={onApprove}
        disabled={approveDisabled}
      >
        {pendingStatus === 'אושר' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} אשר כמות
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-7 text-xs gap-1 text-red-500 border-red-300 hover:bg-red-50"
        onClick={onReject}
        disabled={pending}
      >
        {pendingStatus === 'נדחה' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} דחה כמות
      </Button>
    </div>
  );
}

function PendingQuantityReview({ logistics, date, workplaceId, onStatus, pending, pendingStatus }) {
  const saved = logistics?.reported_units ?? null;
  const [draft, setDraft] = useState(saved);

  useEffect(() => {
    setDraft(saved);
  }, [saved, logistics?.id]);

  const showActions = Boolean(logistics?.id && logistics.units_status === 'ממתין');

  return (
    <div className="flex items-center gap-1 flex-wrap">
      <UnitsQuantityInput
        date={date}
        workplaceId={workplaceId}
        logistics={logistics}
        unitsName={logistics?.units_name || ""}
        compact
        showSave={!showActions}
        disabled={pending}
        onValueChange={showActions ? setDraft : undefined}
      />
      {showActions && (
        <QuantityActions
          reportedUnits={draft}
          pending={pending}
          pendingStatus={pendingStatus}
          onApprove={() => onStatus(logistics, 'אושר', draft)}
          onReject={() => onStatus(logistics, 'נדחה', draft)}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }) {
  return (
    <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_STYLES[status] || ''}`}>
      {status}
    </span>
  );
}

function ReportRow({ report, onStatus, isIndividual, readOnly, pending, pendingStatus }) {
  const duration = calcDuration(report.start_time, report.end_time);
  return (
    <tr className={`hover:bg-secondary/20 transition-colors ${isIndividual ? 'bg-yellow-50/40' : ''}`}>
      <td className="px-4 py-3 font-medium text-base">
        {isIndividual && <User size={13} className="inline ml-1 text-yellow-600" />}
        {report.student_name}
      </td>
      {!isIndividual && (
        <td className="px-4 py-3 text-muted-foreground text-base">{report.workplace_name}</td>
      )}
      {isIndividual && <td className="px-4 py-3 text-xs text-muted-foreground italic">{report.workplace_name}</td>}
      <td className="px-4 py-3 font-mono text-base">{report.start_time || '—'}</td>
      <td className="px-4 py-3 font-mono text-base">{report.end_time || '—'}</td>
      <td className="px-4 py-3 font-mono font-semibold text-base">
        {duration !== null ? duration.toFixed(2) : '—'}
      </td>
      <td className="px-4 py-3"><StatusBadge status={report.status} /></td>
      <td className="px-4 py-3">{!readOnly && <ActionButtons report={report} onStatus={onStatus} pending={pending} pendingStatus={pendingStatus} />}</td>
    </tr>
  );
}

export default function TimeReportsAdmin() {
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [activeTab, setActiveTab] = useState('ממתין');

  const { user: currentUser, isLoadingAuth: loadingUser } = useAuth();
  const readOnly = !canApproveTimeReports(currentUser);

  const { data: reports = [], isLoading } = useTimeReportsByDate(selectedDate);
  const { data: assignments = [], isLoading: assignmentsLoading } = useAssignments(selectedDate);
  const { logisticsMap } = useLogisticsByWorkplace(selectedDate);
  const statusMutation = useBulkTimeReportStatus();
  const quantityMutation = useUpdateWorkplaceLogistics();

  // Fetch all pending reports to show which dates have unreviewed items
  const { data: allPending = [] } = usePendingTimeReports({ sort: 'date', limit: 2000 });
  const { data: pendingQuantities = [] } = usePendingPieceworkQuantities();

  const pendingDates = useMemo(() => {
    const dates = new Set([
      ...allPending.map(r => r.date),
      ...pendingQuantities.map(l => l.date),
    ]);
    return [...dates].filter(Boolean).sort();
  }, [allPending, pendingQuantities]);

  const assignmentByWorkplace = useMemo(() => {
    const map = {};
    assignments.forEach((assignment) => {
      if (!assignment?.workplace_id) return;
      if (!map[assignment.workplace_id]) {
        map[assignment.workplace_id] = {
          workplace_name: assignment.workplace_name || '',
          studentIds: new Set(),
        };
      }
      if (assignment.workplace_name) {
        map[assignment.workplace_id].workplace_name = assignment.workplace_name;
      }
      if (assignment.student_id) {
        map[assignment.workplace_id].studentIds.add(assignment.student_id);
      }
    });
    return map;
  }, [assignments]);

  const datedReports = [...reports].sort((a, b) =>
    (a.workplace_name || '').localeCompare(b.workplace_name || '', 'he'),
  );

  const pending = datedReports.filter(r => r.status === 'ממתין');
  const approved = datedReports.filter(r => r.status === 'אושר');
  const rejected = datedReports.filter(r => r.status === 'נדחה');
  const tabReports = activeTab === 'ממתין' ? pending : activeTab === 'אושר' ? approved : rejected;
  const { workplaceGroups, individualRows } = useMemo(() => {
    // Group by workplace
    const byWorkplace = {};
    tabReports.forEach(r => {
      if (!byWorkplace[r.workplace_id]) byWorkplace[r.workplace_id] = [];
      byWorkplace[r.workplace_id].push(r);
    });

    const workplaceGroups = []; // { workplace_name, workplace_id, representative, students, isUniform }
    const individualRows = []; // reports that differ from their workplace group

    Object.entries(byWorkplace).forEach(([wpId, students]) => {
      // Find the most common time combination among students in this workplace
      const timeFreq = {};
      students.forEach(r => {
        const key = `${r.start_time}|${r.end_time}`;
        timeFreq[key] = (timeFreq[key] || 0) + 1;
      });
      const dominantKey = Object.entries(timeFreq).sort((a, b) => b[1] - a[1])[0][0];
      const [dominantStart, dominantEnd] = dominantKey.split('|');

      // Representative report for the workplace row (use first student that matches dominant)
      const representative = students.find(r => r.start_time === dominantStart && r.end_time === dominantEnd) || students[0];

      const isUniform = Object.keys(timeFreq).length === 1;

      workplaceGroups.push({
        workplace_id: wpId,
        workplace_name: students[0].workplace_name,
        representative,
        studentCount: students.length,
        isUniform,
      });

      // Students who deviate from the dominant time → individual rows
      students.forEach(r => {
        if (r.start_time !== dominantStart || r.end_time !== dominantEnd) {
          individualRows.push(r);
        }
      });
    });

    if (activeTab === 'ממתין') {
      const groupedIds = new Set(workplaceGroups.map((group) => group.workplace_id));
      Object.values(logisticsMap).forEach((logistics) => {
        if (logistics?.units_status !== 'ממתין') return;
        const workplaceId = logistics.workplace_id;
        if (!workplaceId || groupedIds.has(workplaceId)) return;
        const assignment = assignmentByWorkplace[workplaceId];
        if (!assignment || assignment.studentIds.size === 0) return;
        workplaceGroups.push({
          workplace_id: workplaceId,
          workplace_name: assignment.workplace_name || 'מקום עבודה',
          representative: {
            start_time: DEFAULT_START,
            end_time: DEFAULT_END,
            status: 'ממתין',
          },
          studentCount: assignment.studentIds.size,
          isUniform: true,
          quantityOnly: true,
        });
      });
    }

    workplaceGroups.sort((a, b) => (a.workplace_name || '').localeCompare(b.workplace_name || '', 'he'));
    individualRows.sort((a, b) => (a.workplace_name || '').localeCompare(b.workplace_name || '', 'he'));

    return { workplaceGroups, individualRows };
  }, [tabReports, activeTab, logisticsMap, assignmentByWorkplace]);

  const showUnitsColumn = workplaceGroups.some(
    (g) => g.quantityOnly || logisticsMap[g.workplace_id]?.is_piecework,
  );

  const pendingQuantityOnlyCount = useMemo(() => {
    const pendingWorkplaces = new Set(pending.map((report) => report.workplace_id));
    return Object.values(logisticsMap).filter((logistics) => {
      if (logistics?.units_status !== 'ממתין') return false;
      if (pendingWorkplaces.has(logistics.workplace_id)) return false;
      const assignment = assignmentByWorkplace[logistics.workplace_id];
      return Boolean(assignment && assignment.studentIds.size > 0);
    }).length;
  }, [logisticsMap, pending, assignmentByWorkplace]);

  const handleStatus = (report, status) => {
    statusMutation.mutate({
      ids: [report.id],
      status,
      reportId: report.id,
      date: selectedDate,
    });
  };

  // Approve/reject all students in a workplace group
  const handleWorkplaceStatus = (wpId, status) => {
    const ids = tabReports.filter(r => r.workplace_id === wpId).map(r => r.id);
    if (ids.length === 0) return;
    statusMutation.mutate({
      ids,
      status,
      workplaceId: wpId,
      date: selectedDate,
    });
  };

  const handleQuantityStatus = (logistics, status, reportedUnits) => {
    if (!logistics?.id) return;
    const data = status === 'אושר'
      ? { units: reportedUnits, reported_units: reportedUnits, units_status: 'אושר' }
      : { units_status: 'נדחה' };
    quantityMutation.mutate({
      id: logistics.id,
      date: selectedDate,
      data,
      workplaceId: logistics.workplace_id,
    });
  };

  const tabs = [
    { key: 'ממתין', label: 'ממתינים', count: pending.length + pendingQuantityOnlyCount, color: 'text-yellow-600', icon: Clock },
    { key: 'אושר', label: 'אושרו', count: approved.length, color: 'text-green-600', icon: CheckCircle2 },
    { key: 'נדחה', label: 'נדחו', count: rejected.length, color: 'text-red-500', icon: XCircle },
  ];

  const tableHeaders = (
    <tr>
      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">שם תלמיד</th>
      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">מקום עבודה</th>
      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">כניסה</th>
      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">יציאה</th>
      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">שעות</th>
      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">סטטוס</th>
      <th className="px-4 py-3"></th>
    </tr>
  );

  if (loadingUser) {
    return (
      <div className="p-8 flex justify-center items-center">
        <div className="w-7 h-7 border-4 border-slate-200 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">עדכון זמנים</h2>
          <p className="text-muted-foreground mt-1">אישור ודחיית דיווחי זמנים</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            <CalendarDays size={18} className="text-primary" />
            <input
              type="date"
              value={selectedDate}
              onChange={e => setSelectedDate(e.target.value)}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {pendingDates.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-xs text-yellow-700 font-medium">ממתין לאישור:</span>
              {pendingDates.map(d => (
                <button
                  key={d}
                  onClick={() => setSelectedDate(d)}
                  className={`text-xs px-2.5 py-1 rounded-full font-medium border transition-colors ${
                    d === selectedDate
                      ? 'bg-yellow-400 text-yellow-900 border-yellow-400'
                      : 'bg-yellow-100 text-yellow-700 border-yellow-300 hover:bg-yellow-200'
                  }`}
                >
                  {new Date(d + 'T12:00:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric' })}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(({ key, label, count, color, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} className={activeTab === key ? color : ''} />
            {label}
            {count > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                key === 'ממתין' ? 'bg-yellow-100 text-yellow-700' :
                key === 'אושר' ? 'bg-green-100 text-green-700' :
                'bg-red-100 text-red-700'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {isLoading || assignmentsLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <div key={i} className="h-16 bg-secondary rounded-xl animate-pulse" />)}
        </div>
      ) : workplaceGroups.length === 0 && individualRows.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Clock size={48} className="mx-auto mb-3 opacity-30" />
          <p>
            {reports.length === 0
              ? 'אין דיווחים לתאריך זה'
              : `אין רשומות ב"${activeTab === 'ממתין' ? 'ממתינים' : activeTab === 'אושר' ? 'אושרו' : 'נדחו'}"`
            }
          </p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* --- Section 1: Workplace changes --- */}
          {workplaceGroups.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Building2 size={16} className="text-primary" />
                <h3 className="font-semibold text-base">שינויים במחלקות</h3>
                <span className="text-xs text-muted-foreground">({workplaceGroups.length} מקומות עבודה)</span>
              </div>
              <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
                <table className="w-full text-base">
                  <thead className="bg-secondary/60 border-b border-border">
                    <tr>
                      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">מקום עבודה</th>
                      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">תלמידים</th>
                      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">כניסה</th>
                      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">יציאה</th>
                      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">שעות</th>
                      {showUnitsColumn && (
                        <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">יחידות</th>
                      )}
                      <th className="text-right px-4 py-3 text-base font-semibold text-muted-foreground">סטטוס</th>
                      <th className="px-4 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {workplaceGroups.map(({ workplace_id, workplace_name, representative, studentCount, isUniform, quantityOnly }) => {
                      const duration = calcDuration(representative.start_time, representative.end_time);
                      const logistics = logisticsMap[workplace_id];
                      const isPiecework = Boolean(logistics?.is_piecework) || quantityOnly;
                      const canEditQuantity = !readOnly && activeTab === 'ממתין' && isPiecework;
                      const workplacePending = statusMutation.isPending && statusMutation.variables?.workplaceId === workplace_id;
                      const workplacePendingStatus = workplacePending ? statusMutation.variables?.status : null;
                      const quantityPending = quantityMutation.isPending && quantityMutation.variables?.workplaceId === workplace_id;
                      const quantityPendingStatus = quantityPending ? quantityMutation.variables?.data?.units_status : null;
                      return (
                        <tr key={workplace_id} className="hover:bg-secondary/20 transition-colors">
                          <td className="px-4 py-3 font-semibold text-base">{workplace_name}</td>
                          <td className="px-4 py-3 text-sm text-muted-foreground">
                            <span className="bg-primary/10 text-primary text-xs px-2 py-0.5 rounded-full font-medium">
                              {studentCount} תלמידים
                            </span>
                            {!isUniform && (
                              <span className="mr-2 text-xs text-yellow-600 bg-yellow-100 px-2 py-0.5 rounded-full">שעות מעורבות</span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-base">{representative.start_time || '—'}</td>
                          <td className="px-4 py-3 font-mono text-base">{representative.end_time || '—'}</td>
                          <td className="px-4 py-3 font-mono font-semibold text-base">
                            {duration !== null ? duration.toFixed(2) : '—'}
                          </td>
                          {showUnitsColumn && (
                          <td className="px-4 py-3">
                            {isPiecework ? (
                              canEditQuantity ? (
                                <PendingQuantityReview
                                  logistics={logistics}
                                  date={selectedDate}
                                  workplaceId={workplace_id}
                                  onStatus={handleQuantityStatus}
                                  pending={quantityPending}
                                  pendingStatus={quantityPendingStatus}
                                />
                              ) : (
                                <span className="font-mono text-sm">
                                  {logistics?.units != null
                                    ? `${logistics.units}${logistics.units_name ? ` ${logistics.units_name}` : ""}`
                                    : "—"}
                                </span>
                              )
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          )}
                          <td className="px-4 py-3"><StatusBadge status={representative.status} /></td>
                          <td className="px-4 py-3">
                           {!readOnly && !quantityOnly && (
                             <div className="flex gap-1 justify-end">
                               <Button
                                 size="sm"
                                 variant="outline"
                                 className="h-7 text-xs gap-1 text-green-600 border-green-300 hover:bg-green-50"
                                 onClick={() => handleWorkplaceStatus(workplace_id, 'אושר')}
                                 disabled={workplacePending || tabReports.filter(r => r.workplace_id === workplace_id).every(r => r.status === 'אושר')}
                               >
                                 {workplacePendingStatus === 'אושר' ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} אשר הכל
                               </Button>
                               <Button
                                 size="sm"
                                 variant="outline"
                                 className="h-7 text-xs gap-1 text-red-500 border-red-300 hover:bg-red-50"
                                 onClick={() => handleWorkplaceStatus(workplace_id, 'נדחה')}
                                 disabled={workplacePending || tabReports.filter(r => r.workplace_id === workplace_id).every(r => r.status === 'נדחה')}
                               >
                                 {workplacePendingStatus === 'נדחה' ? <Loader2 size={13} className="animate-spin" /> : <XCircle size={13} />} דחה הכל
                               </Button>
                             </div>
                           )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* --- Section 2: Individual student overrides --- */}
          {individualRows.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <User size={16} className="text-yellow-600" />
                <h3 className="font-semibold text-base">שינויים פרטניים בתלמידים</h3>
                <span className="text-xs text-muted-foreground">({individualRows.length} תלמידים)</span>
              </div>
              <div className="bg-card rounded-2xl border border-yellow-200 shadow-sm overflow-hidden">
                <table className="w-full text-base">
                  <thead className="bg-yellow-50/60 border-b border-yellow-200">
                    {tableHeaders}
                  </thead>
                  <tbody className="divide-y divide-border">
                    {individualRows.map(r => {
                      const rowPending = statusMutation.isPending && statusMutation.variables?.reportId === r.id;
                      return (
                        <ReportRow
                          key={r.id}
                          report={r}
                          onStatus={handleStatus}
                          isIndividual={true}
                          readOnly={readOnly}
                          pending={rowPending}
                          pendingStatus={rowPending ? statusMutation.variables?.status : null}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>
      )}
    </div>
  );
}
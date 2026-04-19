import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Users, Building2, CalendarDays, TrendingUp } from 'lucide-react';
import { format } from 'date-fns';

export default function Dashboard() {
  const today = format(new Date(), 'yyyy-MM-dd');

  const { data: students = [] } = useQuery({
    queryKey: ['students'],
    queryFn: () => base44.entities.Student.list(),
  });

  const { data: workplaces = [] } = useQuery({
    queryKey: ['workplaces'],
    queryFn: () => base44.entities.Workplace.list(),
  });

  const { data: todayAssignments = [] } = useQuery({
    queryKey: ['assignments-today', today],
    queryFn: () => base44.entities.Assignment.filter({ date: today }),
  });

  const stats = [
    {
      label: 'סטודנטים',
      value: students.length,
      icon: Users,
      color: 'bg-primary/10 text-primary',
      border: 'border-primary/20',
    },
    {
      label: 'מקומות עבודה',
      value: workplaces.filter(w => w.is_active !== false).length,
      icon: Building2,
      color: 'bg-accent/10 text-accent',
      border: 'border-accent/20',
    },
    {
      label: 'שיבוצים היום',
      value: todayAssignments.length,
      icon: CalendarDays,
      color: 'bg-success/10 text-success',
      border: 'border-success/20',
    },
    {
      label: 'אחוז שיבוץ',
      value: students.length > 0 ? `${Math.round((todayAssignments.length / students.length) * 100)}%` : '0%',
      icon: TrendingUp,
      color: 'bg-warning/10 text-warning',
      border: 'border-warning/20',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-foreground">לוח בקרה</h2>
        <p className="text-muted-foreground mt-1">{format(new Date(), 'EEEE, dd/MM/yyyy')}</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-10">
        {stats.map(({ label, value, icon: Icon, color, border }) => (
          <div key={label} className={`bg-card rounded-2xl border ${border} p-6 shadow-sm`}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium text-muted-foreground">{label}</span>
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon size={20} />
              </div>
            </div>
            <p className="text-3xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Today's assignments preview */}
      <div className="bg-card rounded-2xl border border-border shadow-sm p-6">
        <h3 className="text-lg font-semibold mb-4">שיבוצים להיום</h3>
        {todayAssignments.length === 0 ? (
          <p className="text-muted-foreground text-sm py-6 text-center">אין שיבוצים להיום</p>
        ) : (
          <div className="divide-y divide-border">
            {todayAssignments.slice(0, 8).map(a => (
              <div key={a.id} className="flex items-center justify-between py-3">
                <span className="font-medium text-sm">{a.student_name}</span>
                <span className="text-sm text-muted-foreground bg-secondary px-3 py-1 rounded-full">{a.workplace_name}</span>
              </div>
            ))}
            {todayAssignments.length > 8 && (
              <p className="text-xs text-muted-foreground pt-3 text-center">ועוד {todayAssignments.length - 8}...</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
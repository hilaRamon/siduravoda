import { useState } from 'react';
import { BarChart2, Users } from 'lucide-react';
import PeriodicWorkReport from '@/components/reports/PeriodicWorkReport';
import PeriodWorkReport from '@/components/reports/PeriodWorkReport';
import StudentWorkReport from '@/components/reports/StudentWorkReport';

export default function Reports() {
  const [activeTab, setActiveTab] = useState('periodic');

  const tabs = [
    { key: 'periodic', label: 'דוח עבודה חודשי', icon: BarChart2 },
    { key: 'period', label: 'דוח עבודה לתקופה', icon: BarChart2 },
    { key: 'student', label: 'דוח עבודת תלמיד', icon: Users },
  ];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">דוחות</h2>
        <p className="text-muted-foreground mt-1">ייצוא ודוחות נתונים</p>
      </div>

      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1 mb-6 w-fit">
        {tabs.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === key ? 'bg-card shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon size={15} />
            {label}
          </button>
        ))}
      </div>

      {activeTab === 'periodic' && <PeriodicWorkReport />}
      {activeTab === 'period' && <PeriodWorkReport />}
      {activeTab === 'student' && <StudentWorkReport />}
    </div>
  );
}
import { useState } from 'react';
import { BookOpen, Settings2, HardDriveDownload, Shield } from 'lucide-react';
import PublishedScheduleCard from '@/components/reports/PublishedScheduleCard';
import TimeReportingLink from '@/components/reports/TimeReportingLink';
import BackupExport from '@/components/reports/BackupExport';
import BackupEmailSettings from '@/components/reports/BackupEmailSettings';
import ImportAssignments from '@/components/reports/ImportAssignments';
import SRSViewer from '@/components/reports/SRSViewer';
import DefaultSettings from '@/components/admin/DefaultSettings';
import UserPermissions from '@/components/admin/UserPermissions';

export default function AdminTools() {
  const [activeTab, setActiveTab] = useState('links');

  const tabs = [
    { key: 'links', label: 'קישורים', icon: BookOpen },
    { key: 'backup', label: 'גיבוי ושחזור', icon: HardDriveDownload },
    { key: 'settings', label: 'הגדרות ברירות מחדל', icon: Settings2 },
    { key: 'permissions', label: 'הרשאות משתמשים', icon: Shield },
    { key: 'srs', label: 'מפרט מערכת', icon: BookOpen },
  ];

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">כלי ניהול</h2>
        <p className="text-muted-foreground mt-1">הגדרות, כלי עזר ומפרט המערכת</p>
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

      {activeTab === 'settings' && <DefaultSettings />}
      {activeTab === 'permissions' && <UserPermissions />}
      {activeTab === 'srs' && <SRSViewer />}

      {activeTab === 'links' && (
        <div className="space-y-4 max-w-2xl">
          <PublishedScheduleCard />
          <TimeReportingLink />
        </div>
      )}

      {activeTab === 'backup' && (
        <div className="space-y-4 max-w-2xl">
          <BackupExport />
          <ImportAssignments />
          <BackupEmailSettings />
        </div>
      )}
    </div>
  );
}

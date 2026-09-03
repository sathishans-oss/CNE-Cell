import React from 'react';
import {
  LayoutDashboard,
  Award,
  Calendar,
  Sparkles,
  FileCheck,
  Images,
  Database,
  MapPin,
  ShieldCheck,
  ClipboardList,
  BarChart3,
  Shield
} from 'lucide-react';
import { SessionUser, ViewMode } from '../types';

interface TopToolbarProps {
  user: SessionUser | null;
  activeView: ViewMode;
  onSelectView: (view: ViewMode) => void;
  upcomingCount?: number;
  myAppsCount?: number;
}

export const TopToolbar: React.FC<TopToolbarProps> = ({
  user,
  activeView,
  onSelectView,
  upcomingCount = 0,
  myAppsCount = 0
}) => {
  const isAdmin = user?.role === 'ADMIN';

  const staffTabs = [
    { id: 'dashboard' as ViewMode, label: 'Home', icon: LayoutDashboard },
    {
      id: 'upcoming' as ViewMode,
      label: 'Upcoming Classes',
      icon: Sparkles,
      badge: upcomingCount > 0 ? upcomingCount : undefined
    },
    { id: 'calendar' as ViewMode, label: 'Calendar', icon: Calendar },
    { id: 'gallery' as ViewMode, label: 'Previous Class Photos', icon: Images },
    { id: 'my-cne' as ViewMode, label: 'My CNE Records', icon: Award },
    {
      id: 'my-applications' as ViewMode,
      label: 'My Applications',
      icon: FileCheck,
      badge: myAppsCount > 0 ? myAppsCount : undefined
    }
  ];

  const adminTabs = [
    { id: 'admin-cne' as ViewMode, label: 'CNE Data Master', icon: Database },
    { id: 'admin-areas' as ViewMode, label: 'Area Master', icon: MapPin },
    { id: 'admin-roles' as ViewMode, label: 'Role Master', icon: ShieldCheck },
    { id: 'admin-applications' as ViewMode, label: 'Applications', icon: ClipboardList },
    { id: 'admin-reports' as ViewMode, label: 'Reports & Stats', icon: BarChart3 }
  ];

  return (
    <div id="cne-top-toolbar" className="bg-slate-900 border-b border-slate-800 shadow-md sticky top-16 z-20">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between overflow-x-auto no-scrollbar py-1.5 gap-2 sm:gap-4">
          {/* Staff Primary Section */}
          <nav className="flex items-center gap-1 sm:gap-1.5 shrink-0" aria-label="Staff Navigation">
            {staffTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeView === tab.id;
              return (
                <button
                  key={tab.id}
                  id={`top-tab-${tab.id}`}
                  type="button"
                  onClick={() => onSelectView(tab.id)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    isActive
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-teal-800 text-teal-100'
                          : 'bg-slate-700/60 text-slate-300'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Admin Tools Section */}
          {isAdmin && (
            <div className="flex items-center gap-1 sm:gap-1.5 shrink-0 pl-2 sm:pl-3 border-l border-slate-700/60">
              <div className="hidden lg:flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-purple-400 mr-1 px-1.5 py-0.5 rounded bg-purple-950/60 border border-purple-800/40">
                <Shield className="w-3 h-3" />
                <span>Admin</span>
              </div>
              <nav className="flex items-center gap-1 sm:gap-1.5" aria-label="Admin Navigation">
                {adminTabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeView === tab.id;
                  return (
                    <button
                      key={tab.id}
                      id={`top-tab-${tab.id}`}
                      type="button"
                      onClick={() => onSelectView(tab.id)}
                      className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                        isActive
                          ? 'bg-purple-700 text-white shadow-sm ring-1 ring-purple-400'
                          : 'text-slate-300 hover:bg-purple-950/50 hover:text-purple-200'
                      }`}
                    >
                      <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-200' : 'text-purple-400'}`} />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

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
  X,
  GraduationCap,
  Home
} from 'lucide-react';
import { SessionUser, ViewMode } from '../types';

export type NavView = ViewMode;

interface SidebarProps {
  user: SessionUser | null;
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
  upcomingCount?: number;
  myAppsCount?: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeView,
  onSelectView,
  isOpenMobile,
  onCloseMobile,
  upcomingCount = 0,
  myAppsCount = 0
}) => {
  const isAdmin = user?.role === 'ADMIN';

  const employeeNavItems = [
    { id: 'home', label: 'CNE Home Portal', icon: Home },
    ...(user
      ? [
          { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { id: 'my-cne', label: 'My CNE Records', icon: Award }
        ]
      : []),
    { id: 'calendar', label: 'CNE Calendar', icon: Calendar },
    {
      id: 'upcoming',
      label: 'Upcoming Classes',
      icon: Sparkles,
      badge: upcomingCount > 0 ? upcomingCount : undefined
    },
    ...(user
      ? [
          {
            id: 'my-applications',
            label: 'My Applications',
            icon: FileCheck,
            badge: myAppsCount > 0 ? myAppsCount : undefined
          }
        ]
      : []),
    { id: 'gallery', label: 'Recent Activities', icon: Images }
  ];

  const adminNavItems = [
    { id: 'admin-cne', label: 'CNE Data Master', icon: Database },
    { id: 'admin-areas', label: 'Area Master', icon: MapPin },
    { id: 'admin-roles', label: 'Role Master', icon: ShieldCheck },
    { id: 'admin-applications', label: 'Manage Applications', icon: ClipboardList },
    { id: 'admin-reports', label: 'CNE Reports & Stats', icon: BarChart3 }
  ];

  const handleNavClick = (view: NavView) => {
    onSelectView(view);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-xs md:hidden"
          onClick={onCloseMobile}
        />
      )}

      {/* Sidebar Container */}
      <aside
        id="cne-sidebar"
        className={`fixed md:sticky top-0 md:top-16 z-50 md:z-20 h-screen md:h-[calc(100vh-4rem)] w-64 bg-slate-900 text-slate-300 flex flex-col justify-between border-r border-slate-800 transition-transform duration-200 ease-in-out ${
          isOpenMobile ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        {/* Top Header for Mobile */}
        <div className="flex items-center justify-between p-4 border-b border-slate-800 md:hidden">
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <GraduationCap className="w-5 h-5 text-emerald-400" />
            <span>CNE Management</span>
          </div>
          <button
            id="btn-sidebar-close"
            onClick={onCloseMobile}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Sections */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
          {/* Main Navigation */}
          <div>
            <div className="px-3 mb-2 text-[11px] font-bold uppercase tracking-wider text-slate-500">
              General
            </div>
            <nav className="space-y-1">
              {employeeNavItems.map((item) => {
                const Icon = item.icon;
                const isActive = activeView === item.id;
                return (
                  <button
                    key={item.id}
                    id={`nav-item-${item.id}`}
                    onClick={() => handleNavClick(item.id as NavView)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-emerald-600 text-white shadow-xs font-semibold'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge !== undefined && (
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                          isActive
                            ? 'bg-emerald-800 text-emerald-100'
                            : 'bg-emerald-500/20 text-emerald-400'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Admin Navigation */}
          {isAdmin && (
            <div>
              <div className="px-3 mb-2 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-purple-400">
                <span>Admin Portal</span>
                <span className="text-[9px] bg-purple-900/60 text-purple-300 px-1.5 py-0.2 rounded font-semibold">
                  RESTRICTED
                </span>
              </div>
              <nav className="space-y-1">
                {adminNavItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeView === item.id;
                  return (
                    <button
                      key={item.id}
                      id={`nav-item-${item.id}`}
                      onClick={() => handleNavClick(item.id as NavView)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-purple-600 text-white shadow-xs font-semibold'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-purple-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          )}
        </div>

        {/* Sidebar Footer User Info */}
        <div className="p-3 border-t border-slate-800">
          {user ? (
            <div className="bg-slate-800/60 rounded-lg p-3">
              <div className="text-xs font-semibold text-white truncate">
                {user.name}
              </div>
              <div className="text-[11px] text-slate-400 truncate mt-0.5">
                Emp ID: {user.employeeId}
              </div>
              <div className="mt-2 flex items-center justify-between text-[10px] text-slate-400">
                <span className="font-mono">{user.designation}</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  Active
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800/40 rounded-lg p-3 text-center">
              <div className="text-xs font-medium text-slate-400">
                Public Guest View
              </div>
              <div className="text-[10px] text-slate-500 mt-0.5">
                Sign in for CNE Records & PDF
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

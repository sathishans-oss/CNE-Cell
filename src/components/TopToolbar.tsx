import React, { useState, useRef, useEffect } from 'react';
import {
  LayoutDashboard,
  Award,
  Calendar,
  Sparkles,
  MapPin,
  ShieldCheck,
  BarChart3,
  Shield,
  FileText,
  BookOpen,
  ChevronDown,
  SlidersHorizontal
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
    { id: 'dashboard' as ViewMode, label: 'Menu', icon: LayoutDashboard },
    { id: 'calendar' as ViewMode, label: 'CNE Calendar', icon: Calendar },
    {
      id: 'upcoming' as ViewMode,
      label: 'CNE Schedule',
      icon: Sparkles,
      badge: upcomingCount > 0 ? upcomingCount : undefined
    },
    { id: 'my-cne' as ViewMode, label: 'My CNE Records', icon: Award },
    { id: 'learning-resources' as ViewMode, label: 'Learning Resources', icon: BookOpen }
  ];

  // Control Center state & logic for Admins
  const [isControlCenterOpen, setIsControlCenterOpen] = useState(false);
  const controlCenterRef = useRef<HTMLDivElement>(null);
  const controlCenterBtnRef = useRef<HTMLButtonElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number } | null>(null);

  const isControlCenterActive = (['admin-content', 'admin-roles', 'admin-areas'] as ViewMode[]).includes(activeView);

  const controlCenterItems = [
    { id: 'admin-content' as ViewMode, label: 'Admin Content', icon: FileText, desc: 'Circulars, Desk, Quick Links, Photos' },
    { id: 'admin-roles' as ViewMode, label: 'Role', icon: ShieldCheck, desc: 'Staff roles & permissions' },
    { id: 'admin-areas' as ViewMode, label: 'Ward List', icon: MapPin, desc: 'Clinical wards & areas' }
  ];

  const updateDropdownPos = () => {
    if (controlCenterBtnRef.current) {
      const rect = controlCenterBtnRef.current.getBoundingClientRect();
      const dropdownWidth = 210;
      const left = Math.max(8, Math.min(rect.right - dropdownWidth, window.innerWidth - dropdownWidth - 8));
      setDropdownPos({ top: rect.bottom + 6, left });
    }
  };

  const toggleControlCenter = () => {
    if (!isControlCenterOpen) {
      updateDropdownPos();
    }
    setIsControlCenterOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isControlCenterOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (
        controlCenterRef.current &&
        !controlCenterRef.current.contains(e.target as Node)
      ) {
        setIsControlCenterOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsControlCenterOpen(false);
      }
    };

    const handleScrollOrResize = () => {
      updateDropdownPos();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [isControlCenterOpen]);

  return (
    <div id="cne-top-toolbar" className="bg-slate-900 border-b border-slate-800 shadow-md sticky top-16 z-20">
      <div className="max-w-[1600px] mx-auto px-3 sm:px-6 lg:px-8">
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
                {/* Control Center Dropdown */}
                <div ref={controlCenterRef} className="relative inline-block text-left">
                  <button
                    ref={controlCenterBtnRef}
                    id="top-tab-control-center"
                    type="button"
                    onClick={toggleControlCenter}
                    aria-expanded={isControlCenterOpen}
                    aria-haspopup="true"
                    className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      isControlCenterActive
                        ? 'bg-purple-700 text-white shadow-sm ring-1 ring-purple-400'
                        : 'text-slate-300 hover:bg-purple-950/50 hover:text-purple-200'
                    }`}
                  >
                    <SlidersHorizontal className={`w-3.5 h-3.5 ${isControlCenterActive ? 'text-purple-200' : 'text-purple-400'}`} />
                    <span>Control Center</span>
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-150 ${
                        isControlCenterOpen ? 'rotate-180' : ''
                      } ${isControlCenterActive ? 'text-purple-200' : 'text-slate-400'}`}
                    />
                  </button>

                  {/* Dropdown Menu */}
                  {isControlCenterOpen && dropdownPos && (
                    <div
                      id="control-center-dropdown-menu"
                      style={{
                        position: 'fixed',
                        top: `${dropdownPos.top}px`,
                        left: `${dropdownPos.left}px`,
                        width: '210px',
                        zIndex: 60
                      }}
                      className="bg-white rounded-xl shadow-xl border border-slate-200/90 py-1 overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                      role="menu"
                      aria-orientation="vertical"
                    >
                      <div className="px-3 py-1.5 border-b border-slate-100 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        Control Center
                      </div>
                      {controlCenterItems.map((item) => {
                        const ItemIcon = item.icon;
                        const isItemActive = activeView === item.id;
                        return (
                          <button
                            key={item.id}
                            id={`control-center-item-${item.id}`}
                            type="button"
                            onClick={() => {
                              setIsControlCenterOpen(false);
                              onSelectView(item.id);
                            }}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                              isItemActive
                                ? 'bg-purple-50 text-purple-900 font-bold border-l-2 border-purple-600'
                                : 'text-slate-700 hover:bg-slate-50 hover:text-slate-900'
                            }`}
                            role="menuitem"
                          >
                            <ItemIcon
                              className={`w-4 h-4 shrink-0 ${
                                isItemActive ? 'text-purple-600' : 'text-slate-400'
                              }`}
                            />
                            <div className="min-w-0 flex-1">
                              <div className="leading-tight">{item.label}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* 3. Report and Stats */}
                <button
                  id="top-tab-admin-reports"
                  type="button"
                  onClick={() => {
                    setIsControlCenterOpen(false);
                    onSelectView('admin-reports');
                  }}
                  className={`flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    activeView === 'admin-reports'
                      ? 'bg-purple-700 text-white shadow-sm ring-1 ring-purple-400'
                      : 'text-slate-300 hover:bg-purple-950/50 hover:text-purple-200'
                  }`}
                >
                  <BarChart3 className={`w-3.5 h-3.5 ${activeView === 'admin-reports' ? 'text-purple-200' : 'text-purple-400'}`} />
                  <span>Report and Stats</span>
                </button>
              </nav>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

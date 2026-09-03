import React, { useState, useEffect } from 'react';
import { ViewMode, SessionUser } from './types';
import { ApiService } from './services/api';
import { ToastProvider, useToast } from './components/Toast';
import { Navbar } from './components/Navbar';
import { TopToolbar } from './components/TopToolbar';
import { CneHomePage } from './components/CneHomePage';
import { LoginModal } from './components/LoginModal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ForgotPasswordModal } from './components/ForgotPasswordModal';
import { AppsScriptSetupModal } from './components/AppsScriptSetupModal';
import { Dashboard } from './components/Dashboard';
import { MyCNE } from './components/MyCNE';
import { CNECalendar } from './components/CNECalendar';
import { UpcomingClasses } from './components/UpcomingClasses';
import { Gallery } from './components/Gallery';
import { AdminCNEData } from './components/AdminCNEData';
import { AdminAreas } from './components/AdminAreas';
import { AdminRoles } from './components/AdminRoles';
import { AdminApplications } from './components/AdminApplications';
import { AdminReports } from './components/AdminReports';
import { AlertTriangle, Database, FlaskConical, Wrench } from 'lucide-react';

const AppContent: React.FC = () => {
  const [user, setUser] = useState<SessionUser | null>(() => ApiService.getSessionUser());
  const [activeView, setActiveView] = useState<ViewMode>('dashboard');

  // Modals state
  const [isLoginOpen, setIsLoginOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [isSetupModalOpen, setIsSetupModalOpen] = useState(false);
  const [openAddCneOnAdmin, setOpenAddCneOnAdmin] = useState(false);
  const [backendRefreshTrigger, setBackendRefreshTrigger] = useState(0);

  const { success, info } = useToast();

  const isLive = ApiService.isLiveBackendConnected();
  const envMode = ApiService.getEnvironmentMode();
  const isSandbox = envMode === 'sandbox';

  const handleLoginSuccess = (loggedInUser: SessionUser) => {
    setUser(loggedInUser);
    setIsLoginOpen(false);
    success(`Welcome, ${loggedInUser.name}`, 'Authentication Successful');
  };

  const handleLogout = () => {
    ApiService.logout();
    setUser(null);
    setIsLoginOpen(false);
    info('You have been signed out.', 'Session Ended');
  };

  const handleNavigate = (view: ViewMode) => {
    // If not logged in and attempting to access staff/admin protected views, prompt login
    if (!user || !user.employeeId) {
      if (['my-cne', 'my-applications', 'admin-cne', 'admin-areas', 'admin-roles', 'admin-applications', 'admin-reports'].includes(view)) {
        info('Please log in with your Employee ID to access this section.', 'Authentication Required');
        setIsLoginOpen(true);
        return;
      }
    }
    setActiveView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenAddCNE = () => {
    setOpenAddCneOnAdmin(true);
    setActiveView('admin-cne');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 antialiased selection:bg-emerald-500 selection:text-white">
      {/* Top Fixed Navigation Bar */}
      <Navbar
        user={user}
        onOpenLogin={() => setIsLoginOpen(true)}
        onChangePasswordClick={() => setIsChangePasswordOpen(true)}
        onOpenBackendSetup={() => setIsSetupModalOpen(true)}
        onLogout={handleLogout}
      />

      {/* Persistent Static Top Toolbar for Primary Navigation */}
      <TopToolbar
        user={user}
        activeView={activeView}
        onSelectView={handleNavigate}
      />

      {/* Institutional Environment Warning Banners */}
      {isSandbox ? (
        <div className="bg-amber-500 text-slate-950 px-4 py-2 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <FlaskConical className="w-4 h-4" />
              <span>
                SANDBOX MODE ACTIVE: Running in local offline test mode. Data changes are temporary and NOT saved to Google Sheets.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setIsSetupModalOpen(true)}
              className="underline hover:text-white text-[11px] font-semibold cursor-pointer shrink-0"
            >
              Switch to Production
            </button>
          </div>
        </div>
      ) : !isLive ? (
        <div className="bg-rose-600 text-white px-4 py-2.5 text-xs font-bold flex items-center justify-between shadow-xs">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              <span>
                BACKEND NOT CONFIGURED: Google Apps Script Web App URL is not connected. Connect your Google Sheets backend to enable live data.
              </span>
            </span>
            <button
              type="button"
              onClick={() => setIsSetupModalOpen(true)}
              className="bg-white text-rose-700 px-2.5 py-1 rounded-md text-[11px] font-extrabold hover:bg-rose-50 transition-colors shrink-0 cursor-pointer shadow-xs"
            >
              Configure Backend
            </button>
          </div>
        </div>
      ) : null}

      <div className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 pb-12">
        {/* Main Content Area */}
        <main className="w-full">
          {activeView === 'dashboard' && (
            <CneHomePage
              user={user}
              onNavigate={handleNavigate}
              onOpenLogin={() => setIsLoginOpen(true)}
              onOpenBackendSetup={() => setIsSetupModalOpen(true)}
            />
          )}

          {activeView === 'my-cne' && (
            user ? <MyCNE user={user} /> : null
          )}

          {activeView === 'calendar' && <CNECalendar />}

          {activeView === 'upcoming' && (
            <UpcomingClasses user={user} defaultTab="classes" />
          )}

          {activeView === 'my-applications' && (
            user ? <UpcomingClasses user={user} defaultTab="my-applications" /> : null
          )}

          {activeView === 'gallery' && <Gallery user={user} />}

          {/* Admin Protected Views */}
          {activeView === 'admin-cne' && user?.role === 'ADMIN' && (
            <AdminCNEData
              user={user}
              isOpenAddModalDefault={openAddCneOnAdmin}
            />
          )}

          {activeView === 'admin-areas' && user?.role === 'ADMIN' && (
            <AdminAreas user={user} />
          )}

          {activeView === 'admin-roles' && user?.role === 'ADMIN' && (
            <AdminRoles user={user} />
          )}

          {activeView === 'admin-applications' && user?.role === 'ADMIN' && (
            <AdminApplications user={user} />
          )}

          {activeView === 'admin-reports' && user?.role === 'ADMIN' && (
            <AdminReports user={user} />
          )}
        </main>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6 text-center text-xs text-slate-500 mt-auto">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© 2026 Nursing Informatics | Department of Nursing | AIIMS Rishikesh</span>
          <span>Clinical Nursing Education (CNE) Portal</span>
        </div>
      </footer>

      {/* Global Modals */}
      <LoginModal
        isOpen={isLoginOpen}
        onClose={() => setIsLoginOpen(false)}
        onLoginSuccess={handleLoginSuccess}
        onOpenForgotPassword={() => {
          setIsLoginOpen(false);
          setIsForgotPasswordOpen(true);
        }}
        onOpenBackendSetup={() => {
          setIsLoginOpen(false);
          setIsSetupModalOpen(true);
        }}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
        user={user}
      />

      <ForgotPasswordModal
        isOpen={isForgotPasswordOpen}
        onClose={() => setIsForgotPasswordOpen(false)}
        onBackToLogin={() => {
          setIsForgotPasswordOpen(false);
          setIsLoginOpen(true);
        }}
      />

      <AppsScriptSetupModal
        isOpen={isSetupModalOpen}
        onClose={() => setIsSetupModalOpen(false)}
        onBackendConfigured={() => setBackendRefreshTrigger((prev) => prev + 1)}
      />
    </div>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <AppContent />
    </ToastProvider>
  );
}

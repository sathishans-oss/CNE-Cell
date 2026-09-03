import React from 'react';
import {
  GraduationCap,
  LogOut,
  KeyRound,
  Database,
  CheckCircle2,
  AlertTriangle,
  FlaskConical,
  LogIn
} from 'lucide-react';
import { SessionUser } from '../types';
import { ApiService } from '../services/api';

interface NavbarProps {
  user: SessionUser | null;
  onLogout: () => void;
  onChangePasswordClick: () => void;
  onOpenBackendSetup: () => void;
  onOpenLogin?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  user,
  onLogout,
  onChangePasswordClick,
  onOpenBackendSetup,
  onOpenLogin
}) => {
  const isLive = ApiService.isLiveBackendConnected();
  const envMode = ApiService.getEnvironmentMode();
  const isSandbox = envMode === 'sandbox';

  return (
    <header id="cne-navbar" className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand / Institutional Title */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center shadow-xs">
                <GraduationCap className="w-6 h-6 text-teal-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-base sm:text-lg text-slate-900 leading-none">
                    CNE Management System
                  </span>
                  <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-teal-100 text-teal-800">
                    AIIMS Rishikesh
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block mt-0.5">
                  Department of Nursing Services • Continuing Education Portal
                </p>
              </div>
            </div>
          </div>

          {/* Right Action Bar */}
          <div className="flex items-center gap-2 sm:gap-4">
            {/* Backend Status Pill */}
            <button
              id="btn-backend-status-pill"
              onClick={onOpenBackendSetup}
              title="Google Sheets & Apps Script Configuration"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                isSandbox
                  ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  : isLive
                  ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
                  : 'bg-rose-50 text-rose-800 border-rose-300 hover:bg-rose-100'
              }`}
            >
              {isSandbox ? (
                <>
                  <FlaskConical className="w-3.5 h-3.5 text-amber-600" />
                  <span className="hidden md:inline">Sandbox Mode</span>
                </>
              ) : isLive ? (
                <>
                  <Database className="w-3.5 h-3.5 text-teal-600" />
                  <span className="hidden md:inline">Google Sheets Live</span>
                  <CheckCircle2 className="w-3 h-3 text-teal-600" />
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5 text-rose-600" />
                  <span className="hidden md:inline">Backend Not Connected</span>
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                </>
              )}
            </button>

            {user && user.employeeId ? (
              <div className="flex items-center gap-2 sm:gap-3">
                {/* User Profile Info */}
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold text-slate-900 leading-tight">
                    {user.name}
                  </div>
                  <div className="flex items-center justify-end gap-1 text-[11px] text-slate-500">
                    <span>{user.designation}</span>
                    <span>•</span>
                    <span
                      className={`font-bold px-1.5 py-0.2 rounded text-[9px] uppercase tracking-wider ${
                        user.role === 'ADMIN'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                </div>

                {/* Change Password Action */}
                <button
                  id="btn-nav-change-password"
                  onClick={onChangePasswordClick}
                  title="Change Password"
                  className="p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                  aria-label="Change Password"
                >
                  <KeyRound className="w-4 h-4" />
                </button>

                {/* Logout Action */}
                <button
                  id="btn-nav-logout"
                  onClick={onLogout}
                  title="Sign Out"
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Sign Out</span>
                </button>
              </div>
            ) : (
              onOpenLogin && (
                <button
                  id="btn-nav-login"
                  type="button"
                  onClick={onOpenLogin}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Log In</span>
                </button>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

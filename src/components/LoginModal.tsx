import React, { useState } from 'react';
import { GraduationCap, Lock, User, AlertCircle, ArrowRight, HelpCircle, X } from 'lucide-react';
import { ApiService } from '../services/api';
import { SessionUser } from '../types';
import { useToast } from './Toast';

interface LoginModalProps {
  isOpen?: boolean;
  onClose?: () => void;
  onLoginSuccess: (user: SessionUser) => void;
  onOpenForgotPassword: () => void;
}

export const LoginModal: React.FC<LoginModalProps> = ({
  isOpen = true,
  onClose,
  onLoginSuccess,
  onOpenForgotPassword,
}) => {
  const [employeeId, setEmployeeId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showHelper, setShowHelper] = useState(false);

  const { success, error } = useToast();

  if (!isOpen) return null;

  const performLogin = async (empId: string, pass: string) => {
    setLoading(true);
    setErrorMsg('');

    try {
      const response = await ApiService.login(empId.trim(), pass.trim());
      if (response.success && response.data) {
        success(`Welcome, ${response.data.name}`, 'Login Successful');
        onLoginSuccess(response.data);
      } else {
        const msg = response.message || 'Login failed. Please verify your credentials.';
        setErrorMsg(msg);
        error(msg, 'Authentication Error');
      }
    } catch (err: any) {
      const msg = err?.message || 'Server error occurred during login.';
      setErrorMsg(msg);
      error(msg, 'Connection Error');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !password.trim()) {
      setErrorMsg('Please enter both your Employee ID and Password.');
      return;
    }
    await performLogin(employeeId, password);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200 relative my-8">
        {onClose && (
          <button
            id="btn-close-login"
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="sm:mx-auto sm:w-full sm:max-w-md">
          {/* Institutional Crest / Icon */}
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-teal-950 flex items-center justify-center shadow-lg border border-teal-800">
              <GraduationCap className="w-8 h-8 text-teal-400" />
            </div>
          </div>

          <h1 className="mt-3 text-center text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            CNE Management System
          </h1>
          <p className="mt-0.5 text-center text-xs sm:text-sm font-medium text-teal-700">
            AIIMS, Rishikesh
          </p>
          <p className="text-center text-xs text-slate-500 mt-0.5">
            Department of Nursing • CNE Portal
          </p>
        </div>

        <div className="mt-6">
          <form id="form-login" onSubmit={handleSubmit} className="space-y-4">
            {errorMsg && (
              <div
                id="login-error-alert"
                className="p-3.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-900 text-xs leading-relaxed"
              >
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                  <div className="font-medium">{errorMsg}</div>
                </div>
              </div>
            )}

            {/* Employee ID Field */}
            <div>
              <label
                htmlFor="input-employee-id"
                className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5"
              >
                Employee ID No.
              </label>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="input-employee-id"
                  type="text"
                  required
                  value={employeeId}
                  onChange={(e) => setEmployeeId(e.target.value)}
                  placeholder="example ID: RSNHO000001"
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-700 focus:bg-white transition-all uppercase"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="input-password"
                  className="block text-xs font-bold uppercase tracking-wider text-slate-700"
                >
                  Password
                </label>
                <button
                  id="btn-forgot-password-link"
                  type="button"
                  onClick={onOpenForgotPassword}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative rounded-lg shadow-xs">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="input-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 text-sm placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-700 focus:bg-white transition-all"
                />
              </div>
            </div>

            {/* Institutional Password Notice */}
            <div className="rounded-lg bg-teal-50/60 p-3 border border-teal-200 text-xs text-teal-900">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-teal-900 flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-teal-700" />
                  First-time login info
                </span>
                <button
                  type="button"
                  onClick={() => setShowHelper(!showHelper)}
                  className="text-teal-700 hover:underline font-medium text-[11px] cursor-pointer"
                >
                  {showHelper ? 'Hide' : 'Details'}
                </button>
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-teal-800">
                Default first-time password: <code className="bg-white border border-teal-300 font-bold px-1.5 py-0.5 rounded text-teal-950">pass1234</code>
              </p>
              <p className="text-[11px] text-teal-700 mt-0.5">
                You will be required to change your password on first login.
              </p>
              {showHelper && (
                <p className="mt-1.5 text-[11px] text-slate-600 border-t border-teal-200/60 pt-1.5">
                  Once you have set your personal password, use your new password to log in. If forgotten, you can reset it via &quot;Forgot password?&quot; above.
                </p>
              )}
            </div>

            {/* Submit Button */}
            <button
              id="btn-login-submit"
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-lg shadow-sm text-sm font-semibold text-white bg-teal-800 hover:bg-teal-900 focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-teal-700 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
            >
              {loading ? (
                <span>Authenticating credentials...</span>
              ) : (
                <>
                  <span>Log In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

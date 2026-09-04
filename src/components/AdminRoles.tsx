import React, { useState, useEffect } from 'react';
import {
  Shield,
  Search,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Loader2,
  X
} from 'lucide-react';
import { Employee, RoleConfig, SessionUser, UserRole } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AdminRolesProps {
  user: SessionUser;
}

export const AdminRoles: React.FC<AdminRolesProps> = ({ user }) => {
  const [officers, setOfficers] = useState<Employee[]>([]);
  const [rolesMap, setRolesMap] = useState<{ [empId: string]: UserRole }>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [updatingEmpId, setUpdatingEmpId] = useState<string | null>(null);
  const [confirmResetOfficer, setConfirmResetOfficer] = useState<{ empId: string; name: string } | null>(null);

  const { success, error } = useToast();

  useEffect(() => {
    loadRolesData();
  }, []);

  const loadRolesData = async () => {
    setLoading(true);
    try {
      const [officersRes, rolesRes] = await Promise.all([
        ApiService.getOfficersDropdown(),
        ApiService.getRoles()
      ]);

      if (officersRes.success && officersRes.data) {
        setOfficers(officersRes.data);
      }

      if (rolesRes.success && rolesRes.data) {
        const map: { [empId: string]: UserRole } = {};
        rolesRes.data.forEach((r) => {
          if (r.employeeId) {
            map[r.employeeId.toLowerCase()] = r.role;
          }
        });
        setRolesMap(map);
      }
    } catch (e: any) {
      error('Failed to load role permissions.');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (empId: string, newRole: UserRole) => {
    const normId = empId.toLowerCase();
    const previousRole = rolesMap[normId] || 'EMPLOYEE';
    if (previousRole === newRole || updatingEmpId) return;

    setUpdatingEmpId(empId);
    try {
      const res = await ApiService.updateRole(empId, newRole);
      if (res.success) {
        success(`Role for ${empId} updated to ${newRole}.`, 'Role Updated');
        setRolesMap((prev) => ({
          ...prev,
          [normId]: newRole
        }));
      } else {
        error(res.message || 'Failed to update role.');
        // Ensure state retains previousRole
        setRolesMap((prev) => ({
          ...prev,
          [normId]: previousRole
        }));
      }
    } catch (e: any) {
      error(e?.message || 'Error updating role.');
      setRolesMap((prev) => ({
        ...prev,
        [normId]: previousRole
      }));
    } finally {
      setUpdatingEmpId(null);
    }
  };

  const executeAdminResetPassword = async (empId: string, name: string) => {
    if (resettingId) return;
    setResettingId(empId);
    try {
      const res = await ApiService.adminResetPassword(empId);
      if (res.success) {
        success(res.message || `Password for ${name} reset to pass1234`, 'Password Reset');
        setConfirmResetOfficer(null);
      } else {
        error(res.message || 'Failed to reset password.');
      }
    } catch (e: any) {
      error('Error resetting employee password.');
    } finally {
      setResettingId(null);
    }
  };

  const filteredOfficers = officers.filter((o) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      (o.name || '').toLowerCase().includes(q) ||
      (o.employeeId || '').toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Role & Access Control Master</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">
              Admin & Employee RBAC
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage system permissions and credentials. Admins can assign roles and reset employee passwords to default (pass1234).
          </p>
        </div>

        <button
          onClick={loadRolesData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Sync Roles</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            placeholder="Search nursing officer by name, ID, designation..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
          />
        </div>
      </div>

      {/* Roles Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading user roster...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                  <th className="py-3 px-4">Employee ID</th>
                  <th className="py-3 px-4">Officer Name</th>
                  <th className="py-3 px-4">Designation</th>
                  <th className="py-3 px-4">Assigned Role</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfficers.map((officer) => {
                  const empId = (officer.employeeId || '').toLowerCase();
                  const role: UserRole = rolesMap[empId] || 'EMPLOYEE';
                  const isCurrentLoggedUser = empId === (user.employeeId || '').toLowerCase();
                  const isResetting = resettingId === officer.employeeId;

                  return (
                    <tr key={officer.employeeId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-bold text-slate-800 whitespace-nowrap">
                        {officer.employeeId}
                        {isCurrentLoggedUser && (
                          <span className="ml-2 text-[10px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-normal">
                            You
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 font-semibold text-slate-900">
                        {officer.name}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {officer.designation}
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <select
                            value={role}
                            disabled={updatingEmpId === officer.employeeId}
                            onChange={(e) => handleRoleChange(officer.employeeId, e.target.value as UserRole)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border focus:outline-hidden disabled:opacity-60 cursor-pointer ${
                              role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-900 border-purple-300'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            <option value="EMPLOYEE">EMPLOYEE (Default User)</option>
                            <option value="ADMIN">ADMIN (Full Control)</option>
                          </select>
                          {updatingEmpId === officer.employeeId && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-700 shrink-0" />
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setConfirmResetOfficer({ empId: officer.employeeId, name: officer.name })}
                          disabled={isResetting || updatingEmpId === officer.employeeId}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
                          title="Reset employee password to default pass1234"
                        >
                          {isResetting ? (
                            <Loader2 className="w-3 h-3 animate-spin text-amber-600" />
                          ) : (
                            <KeyRound className="w-3 h-3 text-amber-600" />
                          )}
                          <span>{isResetting ? 'Resetting...' : 'Reset to pass1234'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Admin Reset Password Confirmation Modal */}
      {confirmResetOfficer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-700 mx-auto flex items-center justify-center">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Reset Employee Password?</h3>
              <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                Reset password for <strong className="text-slate-800">{confirmResetOfficer.name}</strong> ({confirmResetOfficer.empId}) to the default credentials: <code className="bg-slate-100 px-1 py-0.5 rounded font-mono font-bold text-amber-700">pass1234</code>?
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmResetOfficer(null)}
                disabled={resettingId !== null}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg disabled:opacity-40"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => executeAdminResetPassword(confirmResetOfficer.empId, confirmResetOfficer.name)}
                disabled={resettingId !== null}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 cursor-pointer"
              >
                {resettingId === confirmResetOfficer.empId ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Resetting Password...</span>
                  </>
                ) : (
                  <span>Reset to pass1234</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

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
  X,
  ChevronDown,
  Plus,
  Check
} from 'lucide-react';
import { Employee, RoleConfig, SessionUser, UserRole } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AdminRolesProps {
  user: SessionUser;
}

interface OfficerRoleState {
  role: UserRole;
  assignedAreas: string[];
  area?: string;
}

interface AreaMultiSelectProps {
  employeeId: string;
  assignedAreas: string[];
  areasList: string[];
  disabled?: boolean;
  onSave: (newAreas: string[]) => void;
}

const AreaMultiSelect: React.FC<AreaMultiSelectProps> = ({
  assignedAreas,
  areasList,
  disabled,
  onSave
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filterText, setFilterText] = useState('');
  const popoverRef = React.useRef<HTMLDivElement>(null);

  const selectedAreas = assignedAreas;

  const filteredAreas = React.useMemo(() => {
    if (!filterText.trim()) return areasList;
    const q = filterText.toLowerCase();
    return areasList.filter((a) => a.toLowerCase().includes(q));
  }, [areasList, filterText]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleArea = (area: string) => {
    const isChecked = selectedAreas.includes(area);
    let next: string[];
    if (isChecked) {
      next = selectedAreas.filter((a) => a !== area);
    } else {
      next = [...selectedAreas, area];
    }
    onSave(next);
  };

  const removeArea = (area: string) => {
    const next = selectedAreas.filter((a) => a !== area);
    onSave(next);
  };

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => setIsOpen((prev) => !prev)}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
              selectedAreas.length === 0
                ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                : 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
            }`}
            title="Assign or modify clinical areas/wards"
          >
            {selectedAreas.length === 0 ? (
              <>
                <Plus className="w-3 h-3 text-amber-700" />
                <span>Assign Wards</span>
              </>
            ) : (
              <>
                <span>{selectedAreas.length} Ward{selectedAreas.length > 1 ? 's' : ''} Assigned</span>
                <ChevronDown className="w-3 h-3 text-teal-700" />
              </>
            )}
          </button>
        </div>

        {/* Selected ward chips */}
        {selectedAreas.length > 0 && (
          <div className="flex flex-wrap gap-1 max-w-[280px]">
            {selectedAreas.map((area) => (
              <span
                key={area}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[11px] font-semibold bg-teal-100/90 text-teal-900 border border-teal-200"
              >
                <span>{area}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeArea(area);
                    }}
                    className="hover:text-rose-700 p-0.5 rounded hover:bg-teal-200 cursor-pointer"
                    title={`Remove ${area}`}
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Floating Multi-Select Dropdown */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="text-xs font-bold text-slate-800">
              Assign Wards / Areas ({selectedAreas.length} selected)
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
            <input
              type="text"
              placeholder="Search wards..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-hidden focus:border-teal-500"
            />
          </div>

          {/* Quick Actions */}
          <div className="flex items-center justify-between text-[11px] text-teal-700 px-0.5 pt-0.5">
            <button
              type="button"
              onClick={() => {
                const toAdd = filteredAreas.filter((a) => !selectedAreas.includes(a));
                onSave([...selectedAreas, ...toAdd]);
              }}
              className="hover:underline font-semibold cursor-pointer"
            >
              Select All Filtered
            </button>
            <button
              type="button"
              onClick={() => onSave([])}
              className="hover:underline font-semibold text-rose-600 cursor-pointer"
            >
              Clear All
            </button>
          </div>

          {/* Scrollable list of wards */}
          <div className="max-h-52 overflow-y-auto space-y-0.5 divide-y divide-slate-50 pr-1">
            {filteredAreas.length === 0 ? (
              <div className="text-xs text-slate-400 py-3 text-center">No matching wards</div>
            ) : (
              filteredAreas.map((area) => {
                const isChecked = selectedAreas.includes(area);
                return (
                  <label
                    key={area}
                    className="flex items-center gap-2 px-2 py-1.5 text-xs text-slate-800 rounded-md hover:bg-teal-50/60 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleArea(area)}
                      className="rounded text-teal-600 focus:ring-teal-500 border-slate-300 w-3.5 h-3.5 cursor-pointer"
                    />
                    <span className={`truncate ${isChecked ? 'font-bold text-teal-900' : 'text-slate-700'}`}>
                      {area}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer Done Button */}
          <div className="border-t border-slate-100 pt-1.5 flex justify-end">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold cursor-pointer transition-colors shadow-2xs"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminRoles: React.FC<AdminRolesProps> = ({ user }) => {
  const [officers, setOfficers] = useState<Employee[]>([]);
  const [rolesMap, setRolesMap] = useState<{ [empId: string]: OfficerRoleState }>({});
  const [areasList, setAreasList] = useState<string[]>([]);
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
      const [officersRes, rolesRes, areasRes] = await Promise.all([
        ApiService.getOfficersDropdown(),
        ApiService.getRoles(),
        ApiService.getAreas()
      ]);

      if (officersRes.success && officersRes.data) {
        setOfficers(officersRes.data);
      }

      if (areasRes.success && areasRes.data) {
        setAreasList(areasRes.data.filter((a) => a.status === 'ACTIVE').map((a) => a.name));
      }

      if (rolesRes.success && rolesRes.data) {
        const map: { [empId: string]: OfficerRoleState } = {};
        rolesRes.data.forEach((r) => {
          if (r.employeeId) {
            // Prefer assignedAreas when available; fall back to parsing the existing area string
            let assignedAreas: string[] = [];
            if (Array.isArray(r.assignedAreas) && r.assignedAreas.length > 0) {
              assignedAreas = r.assignedAreas.map((a) => String(a).trim()).filter(Boolean);
            } else if (r.area && typeof r.area === 'string') {
              assignedAreas = r.area
                .split(/[,;\n]+/)
                .map((s) => s.trim())
                .filter(Boolean);
            }

            // Only AREA_INCHARGE keeps assigned areas
            if (r.role !== 'AREA_INCHARGE') {
              assignedAreas = [];
            }

            const areaString = assignedAreas.join(', ');

            map[r.employeeId.toLowerCase()] = {
              role: r.role,
              assignedAreas,
              area: areaString || r.area || ''
            };
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

  const handleRoleChange = async (
    empId: string,
    newRole: UserRole,
    targetAssignedAreas?: string[]
  ) => {
    const normId = empId.toLowerCase();
    const prev: OfficerRoleState = rolesMap[normId] || {
      role: 'EMPLOYEE',
      assignedAreas: [],
      area: ''
    };

    let nextAssignedAreas: string[] = [];
    if (newRole === 'AREA_INCHARGE') {
      if (targetAssignedAreas !== undefined) {
        nextAssignedAreas = targetAssignedAreas.map((a) => a.trim()).filter(Boolean);
      } else {
        // Preserving existing assigned areas, or parsing from area if needed
        nextAssignedAreas = prev.assignedAreas.length > 0
          ? [...prev.assignedAreas]
          : (prev.area ? prev.area.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : []);
      }
    } else {
      // Switching to ADMIN or EMPLOYEE: clear assignedAreas completely
      nextAssignedAreas = [];
    }

    const nextAreaString = nextAssignedAreas.join(', ');

    // Avoid redundant update calls
    const areasUnchanged =
      prev.assignedAreas.length === nextAssignedAreas.length &&
      prev.assignedAreas.every((a, i) => a === nextAssignedAreas[i]);
    if (prev.role === newRole && areasUnchanged && targetAssignedAreas === undefined) return;
    if (updatingEmpId) return;

    setUpdatingEmpId(empId);
    try {
      const res = await ApiService.updateRole(empId, newRole, nextAssignedAreas);
      if (res.success) {
        success(
          `Role for ${empId} updated to ${newRole}${
            newRole === 'AREA_INCHARGE' && nextAssignedAreas.length > 0
              ? ` (${nextAreaString})`
              : ''
          }.`,
          'Role Updated'
        );
        setRolesMap((prevMap) => ({
          ...prevMap,
          [normId]: {
            role: newRole,
            assignedAreas: nextAssignedAreas,
            area: nextAreaString
          }
        }));
      } else {
        error(res.message || 'Failed to update role.');
        setRolesMap((prevMap) => ({
          ...prevMap,
          [normId]: prev
        }));
      }
    } catch (e: any) {
      error(e?.message || 'Error updating role.');
      setRolesMap((prevMap) => ({
        ...prevMap,
        [normId]: prev
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
            <h1 className="text-xl font-bold text-slate-900">Role</h1>
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
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-xs font-medium">Loading data</span>
          </div>
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
                  const roleObj: OfficerRoleState = rolesMap[empId] || { role: 'EMPLOYEE', assignedAreas: [], area: '' };
                  const role: UserRole = roleObj.role;
                  const assignedAreas: string[] = roleObj.assignedAreas || [];
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
                        <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
                          <select
                            value={role}
                            disabled={updatingEmpId === officer.employeeId}
                            onChange={(e) => handleRoleChange(officer.employeeId, e.target.value as UserRole)}
                            className={`px-3 py-1 text-xs font-bold rounded-lg border focus:outline-hidden disabled:opacity-60 cursor-pointer ${
                              role === 'ADMIN'
                                ? 'bg-purple-50 text-purple-900 border-purple-300'
                                : role === 'AREA_INCHARGE'
                                ? 'bg-teal-50 text-teal-900 border-teal-300'
                                : 'bg-slate-100 text-slate-800 border-slate-300'
                            }`}
                          >
                            <option value="EMPLOYEE">EMPLOYEE</option>
                            <option value="AREA_INCHARGE">AREA_INCHARGE</option>
                            <option value="ADMIN">ADMIN</option>
                          </select>

                          {role === 'AREA_INCHARGE' && (
                            <AreaMultiSelect
                              employeeId={officer.employeeId}
                              assignedAreas={assignedAreas}
                              areasList={areasList}
                              disabled={updatingEmpId === officer.employeeId}
                              onSave={(newAreas) => handleRoleChange(officer.employeeId, 'AREA_INCHARGE', newAreas)}
                            />
                          )}

                          {updatingEmpId === officer.employeeId && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-700 shrink-0 self-center" />
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

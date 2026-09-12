import React, { useState, useEffect, useRef } from 'react';
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
import { getCachedOfficers, loadOfficersSingleFlight } from '../services/officerLoader';

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
  const [draftAreas, setDraftAreas] = useState<string[]>(assignedAreas);
  const [filterText, setFilterText] = useState('');
  const popoverRef = React.useRef<HTMLDivElement>(null);

  // Sync draft state with assignedAreas whenever assignedAreas updates and popover is closed
  useEffect(() => {
    if (!isOpen) {
      setDraftAreas(assignedAreas);
    }
  }, [assignedAreas, isOpen]);

  const filteredAreas = React.useMemo(() => {
    if (!filterText.trim()) return areasList;
    const q = filterText.toLowerCase();
    return areasList.filter((a) => a.toLowerCase().includes(q));
  }, [areasList, filterText]);

  const handleOpen = () => {
    if (disabled) return;
    setDraftAreas([...assignedAreas]);
    setFilterText('');
    setIsOpen(true);
  };

  const handleCancel = () => {
    setDraftAreas([...assignedAreas]);
    setIsOpen(false);
  };

  const handleDone = () => {
    setIsOpen(false);
    const isDifferent =
      draftAreas.length !== assignedAreas.length ||
      draftAreas.some((a) => !assignedAreas.includes(a)) ||
      assignedAreas.some((a) => !draftAreas.includes(a));
    if (isDifferent) {
      onSave(draftAreas);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        handleCancel();
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, assignedAreas]);

  const toggleArea = (area: string) => {
    setDraftAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  };

  return (
    <div className="relative inline-block text-left" ref={popoverRef}>
      <button
        type="button"
        disabled={disabled}
        onClick={isOpen ? handleCancel : handleOpen}
        className={`px-2.5 py-1 text-xs font-semibold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50 ${
          assignedAreas.length === 0
            ? 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
            : 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100'
        }`}
        title="Assign or modify clinical areas/wards"
      >
        {assignedAreas.length === 0 ? (
          <>
            <Plus className="w-3 h-3 text-amber-700" />
            <span>Assign Ward</span>
          </>
        ) : (
          <>
            <span>{assignedAreas.length} Ward{assignedAreas.length > 1 ? 's' : ''} Assigned</span>
            <ChevronDown className="w-3 h-3 text-teal-700" />
          </>
        )}
      </button>

      {/* Floating Multi-Select Dropdown with Local Draft */}
      {isOpen && (
        <div className="absolute left-0 z-50 mt-1 w-72 bg-white rounded-xl border border-slate-200 shadow-xl p-2.5 space-y-2">
          <div className="flex items-center justify-between border-b border-slate-100 pb-1.5">
            <span className="text-xs font-bold text-slate-800">
              Assign Wards / Areas ({draftAreas.length} selected)
            </span>
            <button
              type="button"
              onClick={handleCancel}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-md hover:bg-slate-100 cursor-pointer"
              title="Close and discard changes"
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
                const toAdd = filteredAreas.filter((a) => !draftAreas.includes(a));
                setDraftAreas((prev) => [...prev, ...toAdd]);
              }}
              className="hover:underline font-semibold cursor-pointer"
            >
              Select All Filtered
            </button>
            <button
              type="button"
              onClick={() => setDraftAreas([])}
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
                const isChecked = draftAreas.includes(area);
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
              onClick={handleDone}
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
  const [officers, setOfficers] = useState<Employee[]>(() => getCachedOfficers() || []);
  const [rolesMap, setRolesMap] = useState<{ [empId: string]: OfficerRoleState }>({});
  const [areasList, setAreasList] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [resettingId, setResettingId] = useState<string | null>(null);
  const resettingRef = useRef(false);
  const [updatingEmpId, setUpdatingEmpId] = useState<string | null>(null);
  const updatingEmpIdRef = useRef<string | null>(null);
  const syncingRef = useRef(false);
  const [confirmResetOfficer, setConfirmResetOfficer] = useState<{ empId: string; name: string } | null>(null);
  const [removingWardKeys, setRemovingWardKeys] = useState<Set<string>>(() => new Set<string>());
  const removingWardsRef = useRef<Set<string>>(new Set<string>());

  const { success, error } = useToast();

  useEffect(() => {
    loadRolesData();
  }, []);

  const loadRolesData = async () => {
    setLoading(true);
    // Non-blocking background officer directory loading
    loadOfficersSingleFlight()
      .then((officersData) => {
        if (officersData && officersData.length > 0) {
          setOfficers(officersData);
        }
      })
      .catch(() => {});

    try {
      const [rolesRes, areasRes] = await Promise.all([
        ApiService.getRoles(),
        ApiService.getAreas()
      ]);

      if (areasRes.success && areasRes.data) {
        setAreasList(areasRes.data.filter((a) => a.status === 'ACTIVE').map((a) => a.name));
      }

      if (rolesRes.success && rolesRes.data) {
        const map: { [empId: string]: OfficerRoleState } = {};
        rolesRes.data.forEach((r: any) => {
          const empId = (r.employeeId || '').trim().toLowerCase();
          if (empId) {
            // Extract assignedAreas from array or parse from area / departmentarea / department / ward string
            let assignedAreas: string[] = [];
            if (Array.isArray(r.assignedAreas) && r.assignedAreas.length > 0) {
              assignedAreas = r.assignedAreas.map((a: any) => String(a).trim()).filter(Boolean);
            } else {
              const rawAreaStr = r.area || r.assignedAreas || r.departmentarea || r.department || r.ward || '';
              if (typeof rawAreaStr === 'string' && rawAreaStr.trim()) {
                assignedAreas = rawAreaStr
                  .split(/[,;\n]+/)
                  .map((s) => s.trim())
                  .filter(Boolean);
              }
            }

            // Deduplicate assigned wards
            assignedAreas = Array.from(new Set(assignedAreas));

            // Determine effective role: if assignedAreas exist and not ADMIN, ensure AREA_INCHARGE
            let effectiveRole: UserRole = r.role || 'EMPLOYEE';
            if (effectiveRole !== 'ADMIN' && assignedAreas.length > 0) {
              effectiveRole = 'AREA_INCHARGE';
            }

            const areaString = assignedAreas.join(', ');

            map[empId] = {
              role: effectiveRole,
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

  const handleSyncRoles = async () => {
    if (syncingRef.current || loading) return;
    syncingRef.current = true;
    try {
      try {
        localStorage.removeItem('cne_cache_getRoles');
      } catch {}
      await loadRolesData();
    } finally {
      syncingRef.current = false;
    }
  };

  const handleRoleChange = async (
    empId: string,
    newRole: UserRole,
    targetAssignedAreas?: string[]
  ) => {
    const normId = empId.toLowerCase().trim();
    const prev: OfficerRoleState = rolesMap[normId] || {
      role: 'EMPLOYEE',
      assignedAreas: [],
      area: ''
    };

    let nextAssignedAreas: string[] = [];
    if (newRole === 'ADMIN') {
      nextAssignedAreas = [];
    } else if (targetAssignedAreas !== undefined) {
      nextAssignedAreas = targetAssignedAreas.map((a) => a.trim()).filter(Boolean);
    } else if (newRole === 'AREA_INCHARGE') {
      nextAssignedAreas = prev.assignedAreas.length > 0
        ? [...prev.assignedAreas]
        : (prev.area ? prev.area.split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean) : []);
    } else {
      // Switching to EMPLOYEE without targetAssignedAreas: clear assignedAreas
      nextAssignedAreas = [];
    }

    // Deduplicate
    nextAssignedAreas = Array.from(new Set(nextAssignedAreas));

    // If assigned areas exist and not ADMIN, effective role is AREA_INCHARGE
    const effectiveRole: UserRole = (newRole !== 'ADMIN' && nextAssignedAreas.length > 0)
      ? 'AREA_INCHARGE'
      : (newRole === 'AREA_INCHARGE' && nextAssignedAreas.length === 0 ? 'EMPLOYEE' : newRole);

    const nextAreaString = nextAssignedAreas.join(', ');

    // Avoid redundant update calls
    const areasUnchanged =
      prev.assignedAreas.length === nextAssignedAreas.length &&
      prev.assignedAreas.every((a, i) => a === nextAssignedAreas[i]);
    if (prev.role === effectiveRole && areasUnchanged && targetAssignedAreas === undefined) return;
    if (updatingEmpIdRef.current === empId || updatingEmpId) return;

    updatingEmpIdRef.current = empId;
    setUpdatingEmpId(empId);
    try {
      const res = await ApiService.updateRole(empId, effectiveRole, nextAssignedAreas);
      if (res.success) {
        success(
          `Role for ${empId} updated to ${effectiveRole}${
            effectiveRole === 'AREA_INCHARGE' && nextAssignedAreas.length > 0
              ? ` (${nextAreaString})`
              : ''
          }.`,
          'Role Updated'
        );
        setRolesMap((prevMap) => ({
          ...prevMap,
          [normId]: {
            role: effectiveRole,
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
      updatingEmpIdRef.current = null;
      setUpdatingEmpId(null);
    }
  };

  const handleRemoveWard = async (empId: string, wardToRemove: string) => {
    const removeKey = `${empId}:${wardToRemove}`;
    // Defensive guard: return immediately if already removing this ward
    if (removingWardsRef.current.has(removeKey)) return;
    if (updatingEmpId === empId) return;

    // Synchronously set removing state before any async calls
    removingWardsRef.current.add(removeKey);
    setRemovingWardKeys((prev) => {
      const next = new Set(prev);
      next.add(removeKey);
      return next;
    });

    try {
      const normId = empId.toLowerCase().trim();
      const current = rolesMap[normId];
      const currentAreas = current?.assignedAreas || [];
      const updatedAreas = currentAreas.filter((w) => w !== wardToRemove);
      const targetRole: UserRole = current?.role === 'ADMIN'
        ? 'ADMIN'
        : updatedAreas.length > 0
        ? 'AREA_INCHARGE'
        : 'EMPLOYEE';
      await handleRoleChange(empId, targetRole, updatedAreas);
    } finally {
      removingWardsRef.current.delete(removeKey);
      setRemovingWardKeys((prev) => {
        const next = new Set(prev);
        next.delete(removeKey);
        return next;
      });
    }
  };

  const executeAdminResetPassword = async (empId: string, name: string) => {
    if (resettingRef.current || resettingId) return;
    resettingRef.current = true;
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
      resettingRef.current = false;
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
          onClick={handleSyncRoles}
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
                  <th className="py-3 px-4">Assign Ward</th>
                  <th className="py-3 px-4">Assigned Wards</th>
                  <th className="py-3 px-4 text-right">Reset Password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOfficers.map((officer) => {
                  const empId = (officer.employeeId || '').toLowerCase().trim();
                  const roleObj: OfficerRoleState = rolesMap[empId] || { role: 'EMPLOYEE', assignedAreas: [], area: '' };
                  const role: UserRole = roleObj.role;
                  const assignedAreas: string[] = roleObj.assignedAreas || [];
                  const isCurrentLoggedUser = empId === (user.employeeId || '').toLowerCase().trim();
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

                      <td className="py-3 px-4 font-semibold text-slate-900 whitespace-nowrap">
                        {officer.name}
                      </td>

                      <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                        {officer.designation}
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
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

                          {updatingEmpId === officer.employeeId && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin text-purple-700 shrink-0" />
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 whitespace-nowrap">
                        {role !== 'ADMIN' ? (
                          <AreaMultiSelect
                            employeeId={officer.employeeId}
                            assignedAreas={assignedAreas}
                            areasList={areasList}
                            disabled={updatingEmpId === officer.employeeId}
                            onSave={(newAreas) => {
                              const targetRole: UserRole = newAreas.length > 0 ? 'AREA_INCHARGE' : 'EMPLOYEE';
                              handleRoleChange(officer.employeeId, targetRole, newAreas);
                            }}
                          />
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="py-3 px-4">
                        {role !== 'ADMIN' && assignedAreas.length > 0 ? (
                          <div className="flex flex-wrap gap-1 max-w-[320px]">
                            {assignedAreas.map((ward) => {
                              const removeKey = `${officer.employeeId}:${ward}`;
                              const isRemoving = removingWardKeys.has(removeKey);
                              const isOfficerUpdating = updatingEmpId === officer.employeeId;

                              return (
                                <span
                                  key={ward}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-teal-50 text-teal-900 border border-teal-200"
                                >
                                  <span>{ward}</span>
                                  <button
                                    type="button"
                                    disabled={isRemoving || isOfficerUpdating}
                                    onClick={() => handleRemoveWard(officer.employeeId, ward)}
                                    className="text-teal-600 hover:text-rose-600 hover:bg-rose-50 rounded p-0.5 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                                    title={isRemoving ? `Removing ${ward}...` : `Remove ${ward}`}
                                    aria-label={`Remove ${ward}`}
                                  >
                                    {isRemoving ? (
                                      <Loader2 className="w-3 h-3 animate-spin text-teal-700" />
                                    ) : (
                                      <X className="w-3 h-3" />
                                    )}
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
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

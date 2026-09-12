import React, { useState, useRef } from 'react';
import { Plus, Trash2, Calendar, Clock, MapPin, User, BookOpen, AlertCircle, Loader2, X, PlusCircle } from 'lucide-react';
import { DepartmentalScheduleRow, Employee, SessionUser } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';
import { getUserAssignedAreas, calculateCneDuration, validateCneDuration } from '../../utils';
import { CneDateTimeFields } from './CneDateTimeFields';

function parseDateTimeParts(dateTimeStr?: string, defaultTime: string = '09:00') {
  if (!dateTimeStr) return { date: '', time: defaultTime };
  if (dateTimeStr.includes('T')) {
    const [d, t] = dateTimeStr.split('T');
    return { date: d, time: t.substring(0, 5) || defaultTime };
  }
  return { date: dateTimeStr, time: defaultTime };
}

interface DepartmentalScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: SessionUser | null;
  areasList: string[];
  officersList: Employee[];
  onSuccess: () => void;
}

const createInitialRow = (userArea: string = ''): DepartmentalScheduleRow => ({
  id: `dept-row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  topic: '',
  area: userArea,
  date: '',
  toDate: '',
  time: '',
  duration: '00:00:00',
  resourcePersonEmpId: '',
  resourcePersonEmpIds: [],
  resourcePersonName: '',
  externalResourcePersons: [],
  modeOfTeaching: 'Lecture Cum Discussion',
  description: '',
  adminRemarks: ''
});

export const DepartmentalScheduleModal: React.FC<DepartmentalScheduleModalProps> = ({
  isOpen,
  onClose,
  user,
  areasList,
  officersList,
  onSuccess
}) => {
  const { success, error } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const isAreaIncharge = user?.role === 'AREA_INCHARGE';
  const assignedAreas = getUserAssignedAreas(user);
  const defaultArea = (isAreaIncharge && assignedAreas.length > 0) ? assignedAreas[0] : (areasList[0] || '');
  const todayStr = new Date().toISOString().split('T')[0];

  // Initially show exactly 1 blank CNE schedule row
  const [rows, setRows] = useState<DepartmentalScheduleRow[]>([
    createInitialRow(defaultArea)
  ]);
  const [internalOfficers, setInternalOfficers] = useState<Employee[]>(officersList || []);
  const [isResourcePersonsLoading, setIsResourcePersonsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const [extRpInputMap, setExtRpInputMap] = useState<Record<string, string>>({});
  const [rpSearchMap, setRpSearchMap] = useState<Record<string, string>>({});

  // Sync internal officers when prop updates
  React.useEffect(() => {
    if (officersList && officersList.length > 0) {
      setInternalOfficers(officersList);
    }
  }, [officersList]);

  // On-demand fetch of internal officers if modal is opened with empty list
  React.useEffect(() => {
    if (isOpen && (!officersList || officersList.length === 0) && internalOfficers.length === 0 && !isResourcePersonsLoading) {
      let cancelled = false;
      setIsResourcePersonsLoading(true);
      ApiService.getOfficersDropdown()
        .then((res) => {
          if (!cancelled && res.success && res.data) {
            setInternalOfficers(res.data);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) {
            setIsResourcePersonsLoading(false);
          }
        });
      return () => {
        cancelled = true;
      };
    }
  }, [isOpen, officersList, internalOfficers.length, isResourcePersonsLoading]);

  const effectiveOfficers = (officersList && officersList.length > 0) ? officersList : internalOfficers;

  // Reset to exactly 1 blank schedule row whenever modal is opened
  React.useEffect(() => {
    if (isOpen) {
      setRows([createInitialRow(defaultArea)]);
      setExtRpInputMap({});
      setRpSearchMap({});
    }
  }, [isOpen, defaultArea]);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows((prev) => [...prev, createInitialRow(defaultArea)]);
  };

  const handleRemoveRow = (index: number) => {
    if (rows.length <= 1) {
      error('At least one schedule row is required.');
      return;
    }
    setRows((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleRowRpSelection = (rowIndex: number, empId: string) => {
    setRows((prev) => {
      const updated = [...prev];
      const r = updated[rowIndex];
      const currentIds = (r.resourcePersonEmpIds && r.resourcePersonEmpIds.length > 0)
        ? r.resourcePersonEmpIds
        : (r.resourcePersonEmpId ? r.resourcePersonEmpId.split(',').map((s) => s.trim()).filter(Boolean) : []);
      let nextIds: string[];
      if (currentIds.includes(empId)) {
        nextIds = currentIds.filter((id) => id !== empId);
      } else {
        nextIds = [...currentIds, empId];
      }
      const rpNames = nextIds.map((id) => {
        const off = effectiveOfficers.find((o) => o.employeeId === id);
        return off ? off.name : id;
      });
      updated[rowIndex] = {
        ...r,
        resourcePersonEmpIds: nextIds,
        resourcePersonEmpId: nextIds.join(', '),
        resourcePersonName: rpNames.join(', ')
      };
      return updated;
    });
  };

  const handleFieldChange = (index: number, field: keyof DepartmentalScheduleRow, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  const handleAddExternalRp = (rowId: string, index: number) => {
    const raw = (extRpInputMap[rowId] || '').trim();
    if (!raw) return;
    const currentList = rows[index].externalResourcePersons || [];
    if (!currentList.includes(raw)) {
      handleFieldChange(index, 'externalResourcePersons', [...currentList, raw]);
    }
    setExtRpInputMap((prev) => ({ ...prev, [rowId]: '' }));
  };

  const handleRemoveExternalRp = (rowIndex: number, rpIndex: number) => {
    const currentList = rows[rowIndex].externalResourcePersons || [];
    handleFieldChange(
      rowIndex,
      'externalResourcePersons',
      currentList.filter((_, i) => i !== rpIndex)
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    // Validation
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      const rowNum = i + 1;
      if (!r.topic.trim()) {
        error(`Row #${rowNum}: Topic is required.`);
        return;
      }
      if (!r.area.trim()) {
        error(`Row #${rowNum}: Area/Department is required.`);
        return;
      }
      if (isAreaIncharge && assignedAreas.length > 0 && !assignedAreas.some((a) => a.toLowerCase() === r.area.trim().toLowerCase())) {
        error(`Row #${rowNum}: You are not authorized to schedule for "${r.area}". Authorized areas: ${assignedAreas.join(', ')}`);
        return;
      }
      if (!r.date) {
        error(`Row #${rowNum}: From Date & Time is required.`);
        return;
      }
      if (!r.toDate) {
        error(`Row #${rowNum}: To Date & Time is required.`);
        return;
      }

      const dFrom = new Date(r.date);
      const dTo = new Date(r.toDate);
      if (isNaN(dFrom.getTime()) || isNaN(dTo.getTime())) {
        error(`Row #${rowNum}: Please enter valid From Date & Time and To Date & Time.`);
        return;
      }
      if (dTo < dFrom) {
        error(`Row #${rowNum}: To Date & Time cannot be earlier than From Date & Time.`);
        return;
      }

      const checkFrom = new Date(dFrom);
      checkFrom.setHours(0, 0, 0, 0);
      if (checkFrom < todayDate) {
        error(`Row #${rowNum}: Scheduled From Date cannot be in the past.`);
        return;
      }

      const durVal = validateCneDuration(r.duration, r.date, r.toDate);
      if (!durVal.isValid) {
        error(`Row #${rowNum}: ${durVal.message}`);
        return;
      }

      const hasInternalRp = (r.resourcePersonEmpIds && r.resourcePersonEmpIds.length > 0) || !!r.resourcePersonEmpId.trim();
      const hasExtRp = (r.externalResourcePersons && r.externalResourcePersons.length > 0);
      if (!hasInternalRp && !hasExtRp) {
        error(`Row #${rowNum}: Please assign at least one Resource Person (Internal or External).`);
        return;
      }
    }

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const payload = rows.map((r) => {
        const rpIds = (r.resourcePersonEmpIds && r.resourcePersonEmpIds.length > 0)
          ? r.resourcePersonEmpIds
          : r.resourcePersonEmpId
              .split(',')
              .map((id) => id.trim())
              .filter(Boolean);
        const rpNames = rpIds.map((id) => {
          const off = officersList.find((o) => o.employeeId === id);
          return off ? off.name : id;
        });
        if (r.externalResourcePersons && r.externalResourcePersons.length > 0) {
          rpNames.push(...r.externalResourcePersons.map((n) => `${n} (External)`));
        }

        return {
          topic: r.topic.trim(),
          area: r.area.trim(),
          cneType: 'DEPARTMENTAL',
          date: r.date,
          toDate: r.toDate,
          time: '',
          duration: r.duration.trim() || '00:00:00',
          resourcePersonEmpId: rpIds.join(', '),
          resourcePersonEmpIds: rpIds,
          resourcePersonName: rpNames.join(', '),
          externalResourcePersons: r.externalResourcePersons || [],
          modeOfTeaching: r.modeOfTeaching || 'Lecture Cum Discussion',
          description: r.description?.trim() || '',
          proposedByEmpId: user?.employeeId,
          proposedByName: user?.name,
          adminRemarks: r.adminRemarks?.trim() || ''
        };
      });

      const res = await ApiService.addDepartmentalSchedule(payload);
      if (res.success) {
        const count = res.data?.count || rows.length;
        success(`Successfully scheduled ${count} departmental CNE workshop${count > 1 ? 's' : ''}.`, 'Batch Scheduled');
        onSuccess();
        onClose();
      } else {
        error(res.message || 'Failed to schedule departmental CNE sessions.');
      }
    } catch (err: any) {
      error(err?.message || 'Error scheduling departmental CNE batch.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Departmental CNE Schedule
              </h3>
              <p className="text-xs text-slate-500">
                {isAreaIncharge
                  ? `Schedule departmental CNE classes for ${user?.assignedArea || 'your department'}`
                  : 'Schedule departmental continuing nursing education workshops'}
              </p>
            </div>
          </div>

          <button
            id="btn-close-departmental-modal"
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
            {rows.map((row, idx) => {
              const fromParts = parseDateTimeParts(row.date, '09:00');
              const toParts = parseDateTimeParts(row.toDate, '10:30');
              const selectedRowRpIds = (row.resourcePersonEmpIds && row.resourcePersonEmpIds.length > 0)
                ? row.resourcePersonEmpIds
                : (row.resourcePersonEmpId ? row.resourcePersonEmpId.split(',').map((s) => s.trim()).filter(Boolean) : []);
              const search = (rpSearchMap[row.id] || '').toLowerCase().trim();
              const filteredOfficers = effectiveOfficers.filter(
                (o) => !search || o.employeeId.toLowerCase().includes(search) || o.name.toLowerCase().includes(search)
              );

              return (
                <div
                  key={row.id}
                  className={rows.length > 1 ? 'p-4 rounded-2xl border border-slate-200 bg-white shadow-xs space-y-3' : 'space-y-3'}
                >
                  {rows.length > 1 && (
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-emerald-100 text-emerald-800 text-xs font-bold flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Departmental Session #{idx + 1}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveRow(idx)}
                        className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 px-2 py-1 rounded-lg text-xs flex items-center gap-1 font-semibold cursor-pointer transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Item</span>
                      </button>
                    </div>
                  )}

                  {/* 3-Column Coordinated Cards: CNE Details | Date & Duration | Resource Persons */}
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Column 1: CNE Details */}
                    <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-2 flex items-center gap-1.5">
                        <span>1. CNE Details</span>
                      </h4>

                      {/* 1. CNE Topic * */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          CNE Topic <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. Infection Control & Hand Hygiene Protocols"
                          value={row.topic}
                          onChange={(e) => handleFieldChange(idx, 'topic', e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                      </div>

                      {/* 2. Department / Ward * */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Department / Ward <span className="text-rose-500">*</span>
                        </label>
                        {isAreaIncharge ? (
                          assignedAreas.length === 1 ? (
                            <div className="relative">
                              <input
                                type="text"
                                disabled
                                value={assignedAreas[0]}
                                className="w-full p-2.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold cursor-not-allowed"
                              />
                              <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                Locked to Your Ward
                              </span>
                            </div>
                          ) : assignedAreas.length > 1 ? (
                            <select
                              required
                              value={row.area}
                              onChange={(e) => handleFieldChange(idx, 'area', e.target.value)}
                              className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none text-emerald-900 font-semibold"
                            >
                              <option value="">Select from Your Assigned Wards</option>
                              {assignedAreas.map((a) => (
                                <option key={a} value={a}>
                                  {a}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <div className="relative">
                              <input
                                type="text"
                                disabled
                                value={user?.assignedArea || 'No Ward Assigned'}
                                className="w-full p-2.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-xs font-semibold cursor-not-allowed"
                              />
                              <span className="absolute right-2.5 top-2.5 text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                                Locked
                              </span>
                            </div>
                          )
                        ) : (
                          <select
                            required
                            value={row.area}
                            onChange={(e) => handleFieldChange(idx, 'area', e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                          >
                            <option value="">Select Department / Ward...</option>
                            {areasList.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* 3. Teaching Mode */}
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Teaching Mode
                        </label>
                        <select
                          value={row.modeOfTeaching}
                          onChange={(e) => handleFieldChange(idx, 'modeOfTeaching', e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                          <option value="Lecture Cum Discussion">Lecture Cum Discussion</option>
                          <option value="Demonstration">Demonstration</option>
                          <option value="Hands-on Training">Hands-on Training</option>
                          <option value="Workshop">Workshop</option>
                          <option value="Case Study Presentation">Case Study Presentation</option>
                          <option value="Simulation">Simulation</option>
                        </select>
                      </div>

                      {/* 4. Description / Objectives */}
                      <div className="flex-1 flex flex-col">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                          Description / Objectives
                        </label>
                        <textarea
                          rows={3}
                          placeholder="Outline clinical objectives, skills covered, or ward preparations..."
                          value={row.description || ''}
                          onChange={(e) => handleFieldChange(idx, 'description', e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none resize-none flex-1 min-h-[72px]"
                        />
                      </div>
                    </div>

                    {/* Column 2: Date & Duration */}
                    <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 border-b border-teal-100 pb-2 flex items-center gap-1.5">
                        <span>2. Date & Schedule</span>
                      </h4>

                      <div className="space-y-3">
                        {/* 1. Date Controls */}
                        <CneDateTimeFields
                          idPrefix={`dept-sched-${idx}`}
                          fromDate={fromParts.date}
                          fromTime={fromParts.time}
                          toDate={toParts.date}
                          toTime={toParts.time}
                          minDate={todayStr}
                          compact={false}
                          accentColor="emerald"
                          onChange={({ fullFrom, fullTo, calculatedDuration }) => {
                            setRows((prev) => {
                              const updated = [...prev];
                              updated[idx] = {
                                ...updated[idx],
                                date: fullFrom,
                                toDate: fullTo,
                                duration: calculatedDuration !== '00:00:00' ? calculatedDuration : updated[idx].duration
                              };
                              return updated;
                            });
                          }}
                        />

                        {/* 2. Duration */}
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                              Duration (HH:MM:SS) <span className="text-rose-500">*</span>
                            </label>
                            <span className="text-[10px] text-teal-700 font-semibold">Auto-calculated • Editable</span>
                          </div>
                          <input
                            type="text"
                            required
                            placeholder="00:00:00"
                            value={row.duration}
                            onChange={(e) => handleFieldChange(idx, 'duration', e.target.value)}
                            className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-teal-500 focus:outline-none"
                          />
                          <p className="text-[10px] text-slate-500 mt-1">
                            Calculated from From/To dates. Max 8 hours per calendar day. Format: HH:MM:SS
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Column 3: Resource Persons */}
                    <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-900 border-b border-cyan-100 pb-2 flex items-center justify-between">
                        <span>3. Resource Persons</span>
                        <span className="text-[10px] text-slate-500 font-semibold lowercase">
                          {selectedRowRpIds.length + (row.externalResourcePersons?.length || 0)} selected
                        </span>
                      </h4>

                      {/* 1. Internal Resource Persons */}
                      <div className="space-y-2 flex-1 flex flex-col">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                            <span>Internal Faculty (AIIMS Staff)</span>
                            {isResourcePersonsLoading && (
                              <Loader2 className="w-3 h-3 text-cyan-600 animate-spin" />
                            )}
                          </label>
                        </div>

                        {/* Selected RP Tags */}
                        {selectedRowRpIds.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1.5 bg-white rounded-lg border border-slate-200">
                            {selectedRowRpIds.map((empId) => {
                              const officer = effectiveOfficers.find((o) => o.employeeId === empId);
                              return (
                                <span
                                  key={empId}
                                  className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200"
                                >
                                  <span>{empId} - {officer ? officer.name : empId}</span>
                                  <button
                                    type="button"
                                    onClick={() => toggleRowRpSelection(idx, empId)}
                                    className="hover:text-rose-600 cursor-pointer"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              );
                            })}
                          </div>
                        )}

                        {/* Search / Filter input */}
                        <div className="relative">
                          <input
                            type="text"
                            placeholder={isResourcePersonsLoading ? "Loading Resource Persons..." : "Filter officers by name or ID..."}
                            disabled={isResourcePersonsLoading}
                            value={rpSearchMap[row.id] || ''}
                            onChange={(e) =>
                              setRpSearchMap((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                            className="w-full p-2 pr-8 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                          />
                          {isResourcePersonsLoading && (
                            <Loader2 className="w-3.5 h-3.5 text-cyan-600 animate-spin absolute right-2.5 top-2.5" />
                          )}
                        </div>

                        {/* Officers list dropdown / box */}
                        <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100 flex-1">
                          {isResourcePersonsLoading ? (
                            <div className="p-3 text-center text-xs text-slate-500 flex items-center justify-center gap-1.5">
                              <Loader2 className="w-3.5 h-3.5 text-cyan-600 animate-spin" />
                              <span>Loading Resource Persons...</span>
                            </div>
                          ) : filteredOfficers.length === 0 ? (
                            <div className="p-2.5 text-center text-xs text-slate-400">No officers found</div>
                          ) : (
                            filteredOfficers.slice(0, 50).map((officer) => {
                              const isSelected = selectedRowRpIds.includes(officer.employeeId);
                              return (
                                <div
                                  key={officer.employeeId}
                                  onClick={() => toggleRowRpSelection(idx, officer.employeeId)}
                                  className={`flex items-center justify-between p-1.5 text-xs cursor-pointer transition-colors ${
                                    isSelected ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                                  }`}
                                >
                                  <div className="flex items-center gap-2 truncate">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => {}}
                                      className="rounded text-emerald-600 pointer-events-none"
                                    />
                                    <span className="truncate">
                                      {officer.employeeId} - {officer.name}
                                    </span>
                                  </div>
                                  {isSelected && <span className="text-[10px] text-emerald-600 font-bold shrink-0">Selected</span>}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </div>

                      {/* 2. External Resource Person */}
                      <div className="pt-2.5 border-t border-slate-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                            External Resource Person (Guest Faculty)
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            placeholder="e.g. Dr. A. Sen (Visiting Faculty)..."
                            value={extRpInputMap[row.id] || ''}
                            onChange={(e) =>
                              setExtRpInputMap((prev) => ({ ...prev, [row.id]: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddExternalRp(row.id, idx);
                              }
                            }}
                            className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddExternalRp(row.id, idx)}
                            className="px-3 py-1.5 bg-cyan-100 hover:bg-cyan-200 text-cyan-900 font-semibold rounded-lg text-xs cursor-pointer transition-colors shrink-0"
                          >
                            + Add
                          </button>
                        </div>
                        {row.externalResourcePersons && row.externalResourcePersons.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
                            {row.externalResourcePersons.map((name, rpIdx) => (
                              <span
                                key={rpIdx}
                                className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200"
                              >
                                <span>{name} (External)</span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveExternalRp(idx, rpIdx)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Add Row Button */}
            <div className="flex justify-start pt-1">
              <button
                id="btn-add-departmental-row"
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Add Another Schedule</span>
              </button>
            </div>
          </div>

          {/* Sticky Footer */}
          <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              id="btn-submit-departmental-schedule"
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                  <span>Publishing Schedule...</span>
                </>
              ) : (
                <span>Publish Schedule</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

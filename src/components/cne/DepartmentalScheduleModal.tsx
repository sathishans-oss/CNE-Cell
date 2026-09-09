import React, { useState } from 'react';
import { Plus, Trash2, Calendar, Clock, MapPin, User, BookOpen, AlertCircle, Loader2, X } from 'lucide-react';
import { DepartmentalScheduleRow, Employee, SessionUser } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';
import { getUserAssignedAreas } from '../../utils';

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
  time: '14:00 - 15:30',
  duration: '1:30:00',
  resourcePersonEmpId: '',
  resourcePersonName: '',
  externalResourcePersons: [],
  modeOfTeaching: 'Lecture Cum Discussion',
  description: '',
  maxParticipants: 40,
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

  // Requirement: Initially show exactly 2 blank CNE schedule rows
  const [rows, setRows] = useState<DepartmentalScheduleRow[]>([
    createInitialRow(defaultArea),
    createInitialRow(defaultArea)
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [extRpInputMap, setExtRpInputMap] = useState<Record<string, string>>({});

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

    // Validation
    const todayStr = new Date().toISOString().split('T')[0];
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
        error(`Row #${rowNum}: Scheduled Date is required.`);
        return;
      }
      if (r.date < todayStr) {
        error(`Row #${rowNum}: Date cannot be in the past (${r.date}).`);
        return;
      }
      if (r.toDate && r.toDate < r.date) {
        error(`Row #${rowNum}: To Date cannot be earlier than From Date.`);
        return;
      }
      const hasInternalRp = !!r.resourcePersonEmpId.trim();
      const hasExtRp = (r.externalResourcePersons && r.externalResourcePersons.length > 0);
      if (!hasInternalRp && !hasExtRp) {
        error(`Row #${rowNum}: Please assign at least one Resource Person (Internal or External).`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const payload = rows.map((r) => {
        const rpIds = r.resourcePersonEmpId
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
          toDate: r.toDate || r.date,
          time: r.time.trim() || '14:00 - 15:30',
          duration: r.duration.trim() || '1:30:00',
          resourcePersonEmpId: rpIds.join(', '),
          resourcePersonEmpIds: rpIds,
          resourcePersonName: rpNames.join(', '),
          externalResourcePersons: r.externalResourcePersons || [],
          modeOfTeaching: r.modeOfTeaching || 'Lecture Cum Discussion',
          description: r.description?.trim() || '',
          maxParticipants: Number(r.maxParticipants) || 40,
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
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-[92vw] max-w-[1440px] rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                Batch Scheduler
              </span>
              <h2 className="text-base font-bold">Departmental CNE Schedule</h2>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              {isAreaIncharge
                ? `Schedule multiple departmental CNE classes for ${user?.assignedArea || 'your department'}.`
                : 'Schedule multiple departmental continuing nursing education workshops simultaneously.'}
            </p>
          </div>
          <button
            id="btn-close-departmental-modal"
            type="button"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-4 flex-1 bg-slate-50">
            {rows.map((row, idx) => (
              <div
                key={row.id}
                className="bg-white p-4.5 rounded-xl border border-slate-200 shadow-xs space-y-3"
              >
                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 text-[11px] font-bold flex items-center justify-center">
                      {idx + 1}
                    </span>
                    <span className="text-xs font-bold text-slate-800">
                      Departmental CNE Schedule Item #{idx + 1}
                    </span>
                  </div>
                  {rows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(idx)}
                      className="text-rose-600 hover:text-rose-800 text-xs flex items-center gap-1 font-semibold cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Remove Item</span>
                    </button>
                  )}
                </div>

                {/* Horizontal Grid of Fields */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3.5">
                  {/* Column 1: Topic & Ward */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        CNE Topic <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Neonatal Resuscitation Protocols"
                        value={row.topic}
                        onChange={(e) => handleFieldChange(idx, 'topic', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs focus:ring-1 focus:ring-emerald-500"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Department / Ward <span className="text-rose-500">*</span>
                      </label>
                      {isAreaIncharge ? (
                        assignedAreas.length === 1 ? (
                          <input
                            type="text"
                            disabled
                            value={assignedAreas[0]}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-100 text-slate-700 border border-slate-300 rounded-lg cursor-not-allowed font-medium"
                          />
                        ) : assignedAreas.length > 1 ? (
                          <select
                            required
                            value={row.area}
                            onChange={(e) => handleFieldChange(idx, 'area', e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-white border border-teal-300 rounded-lg shadow-xs text-teal-900 font-semibold focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="">Select from Your Assigned Wards</option>
                            {assignedAreas.map((a) => (
                              <option key={a} value={a}>
                                {a}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type="text"
                            disabled
                            value={user?.assignedArea || 'No Ward Assigned'}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-100 text-slate-700 border border-slate-300 rounded-lg cursor-not-allowed font-medium"
                          />
                        )
                      ) : (
                        <select
                          required
                          value={row.area}
                          onChange={(e) => handleFieldChange(idx, 'area', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                        >
                          <option value="">Select Department</option>
                          {areasList.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>
                  </div>

                  {/* Column 2: Dates & Duration */}
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          From Date <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="date"
                          required
                          value={row.date}
                          onChange={(e) => handleFieldChange(idx, 'date', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={row.toDate || ''}
                          min={row.date}
                          onChange={(e) => handleFieldChange(idx, 'toDate', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Session Time
                        </label>
                        <input
                          type="text"
                          placeholder="14:00 - 15:30"
                          value={row.time}
                          onChange={(e) => handleFieldChange(idx, 'time', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-700 mb-1">
                          Duration
                        </label>
                        <input
                          type="text"
                          placeholder="1:30:00"
                          value={row.duration}
                          onChange={(e) => handleFieldChange(idx, 'duration', e.target.value)}
                          className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Column 3: Mode & Capacity */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Teaching Mode
                      </label>
                      <select
                        value={row.modeOfTeaching}
                        onChange={(e) => handleFieldChange(idx, 'modeOfTeaching', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                      >
                        <option value="Lecture Cum Discussion">Lecture Cum Discussion</option>
                        <option value="Demonstration">Demonstration</option>
                        <option value="Hands-on Training">Hands-on Training</option>
                        <option value="Workshop">Workshop</option>
                        <option value="Case Study Presentation">Case Study Presentation</option>
                        <option value="Simulation">Simulation</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Max Participant Capacity
                      </label>
                      <input
                        type="number"
                        min={5}
                        max={200}
                        value={row.maxParticipants}
                        onChange={(e) => handleFieldChange(idx, 'maxParticipants', e.target.value)}
                        className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                      />
                    </div>
                  </div>

                  {/* Column 4: Faculty & Resource Persons */}
                  <div className="space-y-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        Internal Resource Person
                      </label>
                      {officersList.length > 0 ? (
                        <select
                          value={row.resourcePersonEmpId}
                          onChange={(e) => handleFieldChange(idx, 'resourcePersonEmpId', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                        >
                          <option value="">Select Internal Officer</option>
                          {officersList.map((off) => (
                            <option key={off.employeeId} value={off.employeeId}>
                              {off.name} ({off.employeeId})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          type="text"
                          placeholder="Enter Employee ID"
                          value={row.resourcePersonEmpId}
                          onChange={(e) => handleFieldChange(idx, 'resourcePersonEmpId', e.target.value)}
                          className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                        />
                      )}
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 mb-1">
                        External Resource Person
                      </label>
                      <div className="flex gap-1.5">
                        <input
                          type="text"
                          placeholder="Add guest speaker"
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
                          className="flex-1 px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg shadow-xs"
                        />
                        <button
                          type="button"
                          onClick={() => handleAddExternalRp(row.id, idx)}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                      {row.externalResourcePersons && row.externalResourcePersons.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1.5">
                          {row.externalResourcePersons.map((name, rpIdx) => (
                            <span
                              key={rpIdx}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded text-[10px] font-medium"
                            >
                              <span>{name}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExternalRp(idx, rpIdx)}
                                className="text-emerald-500 hover:text-emerald-800"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Add Row Button */}
            <div className="flex justify-start">
              <button
                id="btn-add-departmental-row"
                type="button"
                onClick={handleAddRow}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-50 transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-4 h-4 text-emerald-600" />
                <span>Add Another Schedule Row</span>
              </button>
            </div>
          </div>

          {/* Footer Bar */}
          <div className="px-6 py-3.5 bg-white border-t border-slate-200 flex items-center justify-between shrink-0">
            <span className="text-xs text-slate-500 font-medium">
              {rows.length} departmental schedule row{rows.length > 1 ? 's' : ''} ready to submit
            </span>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                id="btn-submit-departmental-schedule"
                type="submit"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer shadow-xs disabled:opacity-60"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing Schedules...</span>
                  </>
                ) : (
                  <span>Publish Departmental Schedules</span>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

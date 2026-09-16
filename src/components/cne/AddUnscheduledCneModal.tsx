import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Plus,
  Minus,
  Award,
  Users,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen
} from 'lucide-react';
import { Employee, SessionUser } from '../../types';
import { ApiService } from '../../services/api';
import { useToast } from '../Toast';
import { getCachedOfficers, loadOfficersSingleFlight } from '../../services/officerLoader';
import { ConfirmDatePicker } from './ConfirmDatePicker';

interface AddUnscheduledCneModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (cneId?: string) => void;
  areasList: string[];
  officersList: Employee[];
  user: SessionUser | null;
}

export const AddUnscheduledCneModal: React.FC<AddUnscheduledCneModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  areasList,
  officersList,
  user
}) => {
  const { success, error, warning } = useToast();
  const submittingRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [cneType, setCneType] = useState<'CENTRAL' | 'DEPARTMENTAL'>('CENTRAL');
  const [topic, setTopic] = useState('');
  const [area, setArea] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState('09:00');
  const [duration, setDuration] = useState('01:00:00');
  const [modeOfTeaching, setModeOfTeaching] = useState('Lecture Cum Discussion');
  const [description, setDescription] = useState('');
  const [adminRemarks, setAdminRemarks] = useState('');

  // Resource Persons State
  const [selectedRpEmpIds, setSelectedRpEmpIds] = useState<string[]>([]);
  const [rpSearchQuery, setRpSearchQuery] = useState('');
  const [externalRpList, setExternalRpList] = useState<string[]>([]);
  const [externalRpInput, setExternalRpInput] = useState('');

  // Participants State
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [externalStaffList, setExternalStaffList] = useState<string[]>([]);
  const [externalStaffInput, setExternalStaffInput] = useState('');

  // Officers Roster
  const [internalOfficers, setInternalOfficers] = useState<Employee[]>(() => {
    if (officersList && officersList.length > 0) return officersList;
    const cached = getCachedOfficers();
    return cached && cached.length > 0 ? cached : [];
  });
  const [isOfficersLoading, setIsOfficersLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (!internalOfficers || internalOfficers.length === 0) {
        setIsOfficersLoading(true);
        loadOfficersSingleFlight()
          .then((offs) => {
            if (offs && offs.length > 0) setInternalOfficers(offs);
          })
          .catch((err) => console.warn('Failed to load officers for unscheduled modal:', err))
          .finally(() => setIsOfficersLoading(false));
      }
      if (areasList.length > 0 && !area) {
        setArea(areasList[0]);
      }
    }
  }, [isOpen, areasList]);

  if (!isOpen) return null;

  // Filtered Officers for Resource Persons
  const filteredRpOfficers = internalOfficers
    .filter((o) => {
      if (!rpSearchQuery.trim()) return true;
      const q = rpSearchQuery.toLowerCase();
      return (
        o.name.toLowerCase().includes(q) ||
        o.employeeId.toLowerCase().includes(q) ||
        (o.designation && o.designation.toLowerCase().includes(q))
      );
    })
    .slice(0, 8);

  // Filtered Officers for Staff Participants
  const filteredStaffOfficers = internalOfficers
    .filter((o) => {
      if (!staffSearchQuery.trim()) return true;
      const q = staffSearchQuery.toLowerCase();
      return (
        o.name.toLowerCase().includes(q) ||
        o.employeeId.toLowerCase().includes(q) ||
        (o.designation && o.designation.toLowerCase().includes(q))
      );
    })
    .slice(0, 10);

  const toggleRp = (empId: string) => {
    setSelectedRpEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleAddExternalRp = () => {
    const trimmed = externalRpInput.trim();
    if (!trimmed) return;
    if (externalRpList.includes(trimmed)) {
      warning('This external resource person is already in the list.');
      return;
    }
    setExternalRpList((prev) => [...prev, trimmed]);
    setExternalRpInput('');
  };

  const handleRemoveExternalRp = (idx: number) => {
    setExternalRpList((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleStaff = (empId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const handleAddExternalStaff = () => {
    const trimmed = externalStaffInput.trim();
    if (!trimmed) return;
    if (externalStaffList.includes(trimmed)) {
      warning('This attendee is already added.');
      return;
    }
    setExternalStaffList((prev) => [...prev, trimmed]);
    setExternalStaffInput('');
  };

  const handleRemoveExternalStaff = (idx: number) => {
    setExternalStaffList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    if (!topic.trim()) {
      error('CNE Topic is required.');
      return;
    }
    if (!area) {
      error('Clinical Area is required.');
      return;
    }
    if (!date) {
      error('Date is required.');
      return;
    }
    if (selectedRpEmpIds.length === 0 && externalRpList.length === 0) {
      error('Please select at least one Resource Person (Internal or External).');
      return;
    }

    const rpNames = selectedRpEmpIds.map((id) => {
      const off = internalOfficers.find((o) => o.employeeId === id);
      return off ? off.name : id;
    });
    if (externalRpList.length > 0) {
      rpNames.push(...externalRpList.map((n) => `${n} (External)`));
    }

    submittingRef.current = true;
    setIsSubmitting(true);

    try {
      const res = await ApiService.addUnscheduledCNE({
        topic: topic.trim(),
        area,
        cneType,
        fromDate: date,
        toDate: date,
        date,
        time: time || '09:00',
        duration: duration.trim() || '01:00:00',
        resourcePersonEmpId: selectedRpEmpIds.join(', '),
        resourcePersonEmpIds: selectedRpEmpIds,
        resourcePersonName: rpNames.join(', '),
        externalResourcePersons: externalRpList,
        modeOfTeaching,
        description: description.trim(),
        adminRemarks: adminRemarks.trim(),
        proposedByEmpId: user?.employeeId,
        proposedByName: user?.name,
        staffEmpIds: selectedStaffIds,
        staffEmpId: selectedStaffIds.join(', '),
        externalStaffParticipants: externalStaffList,
        status: 'Completed',
        isUnscheduled: true
      });

      if (res.success) {
        success('Unscheduled CNE activity recorded and finalized successfully in CNE Schedule.', 'Activity Recorded');
        onSuccess(res.data?.cneId);
        onClose();
      } else {
        error(res.message || 'Failed to record unscheduled CNE.');
      }
    } catch (err: any) {
      error(err?.message || 'Error recording unscheduled CNE.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-2xl w-[94vw] max-w-[1400px] max-h-[88vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-amber-50/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-slate-900">
                  Record Unscheduled CNE
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 border border-amber-300">
                  Completed / Ad-Hoc
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Log a completed skills session, unscheduled emergency drill, or past workshop with full attendance directly into CNE Schedule
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <div className="p-6 overflow-y-auto flex-1 space-y-5 text-xs">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
              {/* Column 1: Classification & Topic */}
              <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <BookOpen className="w-3.5 h-3.5 text-amber-600" />
                    <span>1. Category & Topic</span>
                  </h4>
                </div>

                {/* CNE Type Toggle */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                    Program Classification *
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setCneType('CENTRAL')}
                      className={`py-2 px-3 rounded-lg font-bold text-xs border transition-colors cursor-pointer text-center ${
                        cneType === 'CENTRAL'
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Central CNE
                    </button>
                    <button
                      type="button"
                      onClick={() => setCneType('DEPARTMENTAL')}
                      className={`py-2 px-3 rounded-lg font-bold text-xs border transition-colors cursor-pointer text-center ${
                        cneType === 'DEPARTMENTAL'
                          ? 'bg-teal-700 text-white border-teal-700'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      Departmental CNE
                    </button>
                  </div>
                </div>

                {/* Topic */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Topic / Subject *
                  </label>
                  <input
                    type="text"
                    required
                    id="unscheduled-topic"
                    placeholder="e.g. Unscheduled Crash Cart Drill & Rapid Defibrillation"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>

                {/* Clinical Ward / Area */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Clinical Ward / Area *
                  </label>
                  <select
                    required
                    id="unscheduled-area"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="">Select Area...</option>
                    {areasList.map((a, idx) => (
                      <option key={`unsched-area-${a}-${idx}`} value={a}>{a}</option>
                    ))}
                  </select>
                </div>

                {/* Mode of Teaching */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Mode of Teaching
                  </label>
                  <select
                    value={modeOfTeaching}
                    onChange={(e) => setModeOfTeaching(e.target.value)}
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  >
                    <option value="Lecture Cum Discussion">Lecture Cum Discussion</option>
                    <option value="Demonstration">Demonstration</option>
                    <option value="Hands-on Training">Hands-on Training</option>
                    <option value="Workshop">Workshop</option>
                    <option value="Case Study Presentation">Case Study Presentation</option>
                    <option value="Simulation">Simulation</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Session Description / Remarks
                  </label>
                  <textarea
                    rows={3}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Brief outline of skills covered, clinical context, or drill objectives..."
                    className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-amber-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Column 2: Date, Time & Resource Persons */}
              <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-indigo-600" />
                    <span>2. Date & Resource Persons</span>
                  </h4>
                </div>

                {/* Date & Time */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Conducted Date *
                    </label>
                    <ConfirmDatePicker
                      id="unscheduled-date"
                      value={date}
                      onChange={(d) => setDate(d)}
                      placeholder="Select Date..."
                    />
                    <span className="text-[10px] text-slate-500 mt-1 block">Past dates are fully valid</span>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                      Conducted Time &amp; Duration
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={time}
                        onChange={(e) => setTime(e.target.value)}
                        className="w-1/2 p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        title="Time"
                      />
                      <input
                        type="text"
                        placeholder="01:00:00"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        className="w-1/2 p-2 bg-white border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        title="Duration (HH:MM:SS)"
                      />
                    </div>
                  </div>
                </div>

                {/* Resource Persons Selection */}
                <div className="space-y-2 pt-2 border-t border-slate-200">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                      Resource Persons / Instructors *
                    </label>
                    <span className="text-[10px] text-indigo-600 font-bold">
                      {selectedRpEmpIds.length + externalRpList.length} Selected
                    </span>
                  </div>

                  {/* Selected RPs Chips */}
                  {selectedRpEmpIds.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-200 rounded-lg max-h-24 overflow-y-auto">
                      {selectedRpEmpIds.map((id, idx) => {
                        const off = internalOfficers.find((o) => o.employeeId === id);
                        return (
                          <span
                            key={`unsched-rp-${id}-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-200 text-[11px] font-semibold"
                          >
                            <span>{off ? off.name : id} ({id})</span>
                            <button
                              type="button"
                              onClick={() => toggleRp(id)}
                              className="text-indigo-500 hover:text-indigo-800"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Search internal officers */}
                  <input
                    type="text"
                    placeholder="Search instructor by name or ID..."
                    value={rpSearchQuery}
                    onChange={(e) => setRpSearchQuery(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />

                  {/* Filtered suggestions list */}
                  <div className="max-h-28 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                    {isOfficersLoading ? (
                      <div className="p-3 text-center text-slate-400">Loading roster...</div>
                    ) : filteredRpOfficers.length === 0 ? (
                      <div className="p-3 text-center text-slate-400">No staff found</div>
                    ) : (
                      filteredRpOfficers.map((o, idx) => {
                        const isSelected = selectedRpEmpIds.includes(o.employeeId);
                        return (
                          <button
                            key={`unsched-rp-off-${o.employeeId || idx}-${idx}`}
                            type="button"
                            onClick={() => toggleRp(o.employeeId)}
                            className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                              isSelected ? 'bg-indigo-50 text-indigo-900 font-bold' : 'hover:bg-slate-50 text-slate-800'
                            }`}
                          >
                            <span>{o.name} <span className="text-slate-400 text-[11px]">({o.employeeId})</span></span>
                            {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-indigo-600" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* External Resource Persons */}
                  <div className="pt-2">
                    <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                      External Resource Person (Outside Hospital)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="Guest speaker name..."
                        value={externalRpInput}
                        onChange={(e) => setExternalRpInput(e.target.value)}
                        className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddExternalRp}
                        className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700"
                      >
                        + Add
                      </button>
                    </div>
                    {externalRpList.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {externalRpList.map((name, idx) => (
                          <span
                            key={`unsched-ext-rp-${name}-${idx}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 text-[11px]"
                          >
                            <span>{name}</span>
                            <button
                              type="button"
                              onClick={() => handleRemoveExternalRp(idx)}
                              className="text-slate-500 hover:text-slate-800"
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

              {/* Column 3: Attended Participants Roster */}
              <div className="space-y-4 bg-slate-50/60 p-4 rounded-xl border border-slate-200">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-emerald-600" />
                    <span>3. Attended Participants</span>
                  </h4>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300">
                    {selectedStaffIds.length + externalStaffList.length} Attendees
                  </span>
                </div>

                <p className="text-[11px] text-slate-500">
                  Select nursing officers and staff who completed this unscheduled CNE session to record their training credits immediately.
                </p>

                {/* Selected Staff Chips */}
                {selectedStaffIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 p-2 bg-white border border-slate-200 rounded-lg max-h-32 overflow-y-auto">
                    {selectedStaffIds.map((id, idx) => {
                      const off = internalOfficers.find((o) => o.employeeId === id);
                      return (
                        <span
                          key={`unsched-staff-${id}-${idx}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-semibold"
                        >
                          <span>{off ? off.name : id} ({id})</span>
                          <button
                            type="button"
                            onClick={() => toggleStaff(id)}
                            className="text-emerald-500 hover:text-emerald-800"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search internal staff */}
                <input
                  type="text"
                  placeholder="Search staff to add as attendees..."
                  value={staffSearchQuery}
                  onChange={(e) => setStaffSearchQuery(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                />

                {/* Filtered staff suggestions */}
                <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                  {isOfficersLoading ? (
                    <div className="p-3 text-center text-slate-400">Loading roster...</div>
                  ) : filteredStaffOfficers.length === 0 ? (
                    <div className="p-3 text-center text-slate-400">No staff found</div>
                  ) : (
                    filteredStaffOfficers.map((o, idx) => {
                      const isSelected = selectedStaffIds.includes(o.employeeId);
                      return (
                        <button
                          key={`unsched-staff-off-${o.employeeId || idx}-${idx}`}
                          type="button"
                          onClick={() => toggleStaff(o.employeeId)}
                          className={`w-full px-2.5 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
                            isSelected ? 'bg-emerald-50 text-emerald-900 font-bold' : 'hover:bg-slate-50 text-slate-800'
                          }`}
                        >
                          <span>{o.name} <span className="text-slate-400 text-[11px]">({o.employeeId})</span></span>
                          {isSelected ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Plus className="w-3.5 h-3.5 text-slate-400" />}
                        </button>
                      );
                    })
                  )}
                </div>

                {/* External Participants */}
                <div className="pt-2 border-t border-slate-200">
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    External / Visiting Attendees
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="External attendee name..."
                      value={externalStaffInput}
                      onChange={(e) => setExternalStaffInput(e.target.value)}
                      className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs"
                    />
                    <button
                      type="button"
                      onClick={handleAddExternalStaff}
                      className="px-3 py-1.5 bg-slate-800 text-white rounded-lg text-xs font-semibold hover:bg-slate-700"
                    >
                      + Add
                    </button>
                  </div>
                  {externalStaffList.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {externalStaffList.map((name, idx) => (
                        <span
                          key={`unsched-ext-staff-${name}-${idx}`}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-slate-200 text-slate-800 text-[11px]"
                        >
                          <span>{name}</span>
                          <button
                            type="button"
                            onClick={() => handleRemoveExternalStaff(idx)}
                            className="text-slate-500 hover:text-slate-800"
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

          {/* Footer Actions */}
          <div className="px-6 py-4 border-t border-slate-200 flex items-center justify-between shrink-0 bg-slate-50/80">
            <div className="text-xs text-slate-500 flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Will be published to CNE Schedule with status <strong>Completed</strong></span>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>

              <button
                type="submit"
                id="btn-submit-unscheduled-cne"
                disabled={isSubmitting}
                className="flex items-center gap-2 px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Recording CNE...</span>
                  </>
                ) : (
                  <>
                    <Award className="w-4 h-4" />
                    <span>Record &amp; Finalize CNE</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

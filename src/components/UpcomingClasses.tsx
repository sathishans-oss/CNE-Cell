import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  PlusCircle,
  X,
  Search,
  Loader2,
  BookOpen
} from 'lucide-react';
import { SessionUser, UpcomingClass } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface UpcomingClassesProps {
  user: SessionUser | null;
  onRequireLogin?: (classId?: string) => void;
}

export const UpcomingClasses: React.FC<UpcomingClassesProps> = ({
  user
}) => {
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Schedule Class Modal State (Admin only)
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newToDate, setNewToDate] = useState('');
  const [newTime, setNewTime] = useState('14:00 - 15:30');
  const [newDuration, setNewDuration] = useState('1:30:00');
  const [selectedRpEmpIds, setSelectedRpEmpIds] = useState<string[]>([]);
  const [rpSearchQuery, setRpSearchQuery] = useState('');
  const [newExternalRpList, setNewExternalRpList] = useState<string[]>([]);
  const [newExternalRpInput, setNewExternalRpInput] = useState('');
  const [newMode, setNewMode] = useState('Lecture Cum Discussion');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxParticipants, setNewMaxParticipants] = useState(40);
  const [areasList, setAreasList] = useState<string[]>([]);
  const [officersList, setOfficersList] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { success, error } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadData();
  }, [isAdmin]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clsRes, areasRes, officersRes] = await Promise.all([
        ApiService.getUpcomingClasses(),
        ApiService.getAreas(),
        isAdmin ? ApiService.getOfficersDropdown() : Promise.resolve({ success: true, data: [] })
      ]);

      if (clsRes.success && clsRes.data) setClasses(clsRes.data);
      if (areasRes.success && areasRes.data) {
        setAreasList(areasRes.data.filter((a) => a.status === 'ACTIVE').map((a) => a.name));
      }
      if (officersRes.success && officersRes.data) setOfficersList(officersRes.data);
    } catch (e: any) {
      error(e?.message || 'Failed to load CNE schedule.');
    } finally {
      setLoading(false);
    }
  };

  const handleAddExternalRp = () => {
    const val = newExternalRpInput.trim();
    if (!val) return;
    if (!newExternalRpList.includes(val)) {
      setNewExternalRpList((prev) => [...prev, val]);
    }
    setNewExternalRpInput('');
  };

  const handleRemoveExternalRp = (idx: number) => {
    setNewExternalRpList((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleRpSelection = (empId: string) => {
    setSelectedRpEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  const filteredRpOfficers = officersList.filter((o) => {
    if (!rpSearchQuery.trim()) return true;
    const q = rpSearchQuery.toLowerCase();
    return (
      o.name.toLowerCase().includes(q) ||
      o.employeeId.toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q)
    );
  });

  const handleCreateUpcomingClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim() || !newArea.trim() || !newDate.trim()) {
      error('Please fill in all required fields (Topic, Area, Date).');
      return;
    }

    if (newDate < todayStr) {
      error('Scheduled From Date cannot be in the past. Please select today or a future date.');
      return;
    }

    if (newToDate && newToDate < newDate) {
      error('To Date cannot be earlier than From Date.');
      return;
    }

    if (selectedRpEmpIds.length === 0 && newExternalRpList.length === 0) {
      error('Please select at least one Resource Person (Internal or External).');
      return;
    }

    const rpNames = selectedRpEmpIds.map((id) => {
      const off = officersList.find((o) => o.employeeId === id);
      return off ? off.name : id;
    });
    if (newExternalRpList.length > 0) {
      rpNames.push(...newExternalRpList.map((n) => `${n} (External)`));
    }

    setIsSubmitting(true);
    try {
      const res = await ApiService.addUpcomingClass({
        topic: newTopic.trim(),
        area: newArea,
        date: newDate,
        toDate: newToDate || newDate,
        time: newTime,
        duration: newDuration,
        resourcePersonEmpId: selectedRpEmpIds.join(', '),
        resourcePersonEmpIds: selectedRpEmpIds,
        resourcePersonName: rpNames.join(', '),
        externalResourcePersons: newExternalRpList,
        modeOfTeaching: newMode,
        description: newDescription.trim(),
        maxParticipants: newMaxParticipants,
        proposedByEmpId: user?.employeeId,
        proposedByName: user?.name,
        status: 'Approved'
      } as any);

      if (res.success) {
        success('Upcoming CNE workshop created and published successfully.', 'CNE Scheduled');
        setIsAddClassOpen(false);
        // Reset form
        setNewTopic('');
        setNewDescription('');
        setNewDate('');
        setNewToDate('');
        setSelectedRpEmpIds([]);
        setRpSearchQuery('');
        setNewExternalRpList([]);
        setNewExternalRpInput('');
        loadData();
      } else {
        error(res.message || 'Failed to schedule CNE.');
      }
    } catch (err: any) {
      error(err?.message || 'Error creating CNE.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getResourcePersonsDisplay = (cls: UpcomingClass) => {
    const internalNames = (cls.resourcePersonEmpId || '')
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => {
        const off = officersList.find((o) => o.employeeId === id);
        return off ? `${off.name} (${id})` : id;
      });
    const externalNames = (cls.externalResourcePersons || []).map((p) => `${p} (Ext)`);
    const all = [...internalNames, ...externalNames];
    return all.length > 0 ? all.join(', ') : cls.resourcePersonName || 'TBD';
  };

  const filteredClasses = classes.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    const rpDisplay = getResourcePersonsDisplay(c).toLowerCase();
    return (
      c.topic.toLowerCase().includes(q) ||
      c.area.toLowerCase().includes(q) ||
      (c.resourcePersonName || '').toLowerCase().includes(q) ||
      rpDisplay.includes(q)
    );
  });

  const availableClasses = filteredClasses.filter(
    (c) => isAdmin || c.status === 'Approved' || c.status === 'OPEN'
  );

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">CNE Schedule</h1>
          <p className="text-xs text-slate-500 mt-1">
            Scheduled clinical skill stations, continuing nursing seminars, and simulation lab workshops.
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-3">
            <button
              id="btn-admin-add-upcoming-class"
              onClick={() => setIsAddClassOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Schedule New CNE</span>
            </button>
          </div>
        )}
      </div>

      {/* Main Content Area */}
      <div className="space-y-4">
        {/* Search bar */}
        <div className="max-w-md">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search CNE topic, department, or instructor..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl shadow-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-xs font-medium">Loading CNE schedule from Google Sheets...</span>
          </div>
        ) : availableClasses.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
            <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No CNE classes scheduled</h3>
            <p className="text-xs text-slate-500">Check back soon for the upcoming CNE training schedule.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {availableClasses.map((cls) => {
              return (
                <div
                  key={cls.classId}
                  className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 flex flex-col justify-between hover:shadow-md transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                        {cls.area}
                      </span>
                      <div className="flex items-center gap-1.5">
                        {cls.status && cls.status.toUpperCase() !== 'APPROVED' && cls.status.toUpperCase() !== 'OPEN' && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                            {cls.status}
                          </span>
                        )}
                        <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                          {cls.duration || 'Scheduled'}
                        </span>
                      </div>
                    </div>

                    <h3 className="text-base font-bold text-slate-900 leading-snug">
                      {cls.topic}
                    </h3>

                    {cls.description && (
                      <p className="text-xs text-slate-600 mt-2 line-clamp-2 leading-relaxed">
                        {cls.description}
                      </p>
                    )}

                    <div className="grid grid-cols-2 gap-2 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>
                          {cls.toDate && cls.toDate !== cls.date
                            ? `${cls.date} to ${cls.toDate}`
                            : cls.date}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{cls.time}</span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">
                          Instructor:{' '}
                          {[
                            cls.resourcePersonName || cls.resourcePersonEmpId,
                            ...(cls.externalResourcePersons ? cls.externalResourcePersons.map((p) => `${p} (Ext)`) : [])
                          ].filter(Boolean).join(', ') || 'TBD'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-slate-400" />
                      <span>Mode: {cls.modeOfTeaching || 'Lecture Cum Discussion'}</span>
                    </div>
                    {cls.area && (
                      <div className="flex items-center gap-1 text-slate-400 text-[11px]">
                        <MapPin className="w-3 h-3" />
                        <span>{cls.area}</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Admin Schedule Class */}
      {isAddClassOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setIsAddClassOpen(false)}
              disabled={isSubmitting}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 disabled:opacity-40 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Schedule New CNE
                </h3>
                <p className="text-xs text-slate-500">
                  Publish training session to the institutional CNE Schedule
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateUpcomingClass} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Topic / Skills Training Subject *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Pediatric Advanced Life Support & Defibrillator Handling"
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Clinical Ward / Area *
                </label>
                <select
                  required
                  value={newArea}
                  onChange={(e) => setNewArea(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">Select Area...</option>
                  {areasList.map((a) => (
                    <option key={a} value={a}>{a}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Scheduled / From Date *
                  </label>
                  <input
                    type="date"
                    required
                    min={todayStr}
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    To Date (Optional)
                  </label>
                  <input
                    type="date"
                    min={newDate || todayStr}
                    value={newToDate}
                    onChange={(e) => setNewToDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Time / Hours
                  </label>
                  <input
                    type="text"
                    value={newTime}
                    onChange={(e) => setNewTime(e.target.value)}
                    placeholder="14:00 - 15:30"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Duration
                  </label>
                  <input
                    type="text"
                    value={newDuration}
                    onChange={(e) => setNewDuration(e.target.value)}
                    placeholder="1:30:00"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Internal Resource Persons Multi-Select */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    Internal Resource Persons (AIIMS Faculty)
                  </label>
                  <span className="text-[10px] text-slate-500 font-medium">
                    {selectedRpEmpIds.length} selected
                  </span>
                </div>

                {/* Selected RP Tags */}
                {selectedRpEmpIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    {selectedRpEmpIds.map((empId) => {
                      const officer = officersList.find((o) => o.employeeId === empId);
                      return (
                        <span
                          key={empId}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200"
                        >
                          <span>{empId} - {officer ? officer.name : ''}</span>
                          <button
                            type="button"
                            onClick={() => toggleRpSelection(empId)}
                            className="hover:text-rose-600 cursor-pointer"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Search input for officers */}
                <input
                  type="text"
                  placeholder="Filter officers by name, employee ID, or designation..."
                  value={rpSearchQuery}
                  onChange={(e) => setRpSearchQuery(e.target.value)}
                  className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                />

                {/* Officers Dropdown / Selection List */}
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg bg-white divide-y divide-slate-100">
                  {filteredRpOfficers.length === 0 ? (
                    <div className="p-2 text-center text-xs text-slate-400">No officers found matching search</div>
                  ) : (
                    filteredRpOfficers.slice(0, 50).map((officer) => {
                      const isSelected = selectedRpEmpIds.includes(officer.employeeId);
                      return (
                        <div
                          key={officer.employeeId}
                          onClick={() => toggleRpSelection(officer.employeeId)}
                          className={`flex items-center justify-between p-2 text-xs cursor-pointer transition-colors ${
                            isSelected ? 'bg-emerald-50 text-emerald-900 font-semibold' : 'hover:bg-slate-50 text-slate-700'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}} // handled by div
                              className="rounded text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                            />
                            <span className="truncate">
                              {officer.employeeId} - {officer.name}{' '}
                              {officer.designation ? `(${officer.designation})` : ''}
                            </span>
                          </div>
                          {isSelected && <span className="text-[10px] text-emerald-600 font-bold shrink-0">Selected</span>}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Max Participant Seats
                </label>
                <input
                  type="number"
                  min={5}
                  max={200}
                  value={newMaxParticipants}
                  onChange={(e) => setNewMaxParticipants(parseInt(e.target.value, 10))}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* External Resource Persons */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-700">
                    External Resource Persons (Guest Faculty / Outside Experts)
                  </label>
                  <span className="text-[10px] text-slate-400">No Employee ID required</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. Dr. A. Sen (Visiting Faculty)..."
                    value={newExternalRpInput}
                    onChange={(e) => setNewExternalRpInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddExternalRp();
                      }
                    }}
                    className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                  <button
                    type="button"
                    onClick={handleAddExternalRp}
                    className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    + Add
                  </button>
                </div>
                {newExternalRpList.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {newExternalRpList.map((rp, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200"
                      >
                        <span>{rp} (External)</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveExternalRp(idx)}
                          className="hover:text-rose-600 cursor-pointer"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Description / Prerequisites
                </label>
                <textarea
                  rows={2}
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Outline syllabus, target audience, or lab preparations..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddClassOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Publishing...</span>
                    </>
                  ) : (
                    <span>Schedule New CNE</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  Calendar,
  Clock,
  MapPin,
  User,
  Users,
  CheckCircle2,
  AlertCircle,
  FileCheck,
  PlusCircle,
  X,
  Search,
  Filter
} from 'lucide-react';
import { CNEApplication, SessionUser, UpcomingClass } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface UpcomingClassesProps {
  user: SessionUser | null;
  defaultTab?: 'classes' | 'my-applications';
  onRequireLogin?: (classId?: string) => void;
}

export const UpcomingClasses: React.FC<UpcomingClassesProps> = ({
  user,
  defaultTab = 'classes',
  onRequireLogin
}) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'my-applications'>(defaultTab);
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [myApplications, setMyApplications] = useState<CNEApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingClass, setApplyingClass] = useState<UpcomingClass | null>(null);
  const [applicationRemarks, setApplicationRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Admin Add Class Modal State
  const [isAddClassOpen, setIsAddClassOpen] = useState(false);
  const [newTopic, setNewTopic] = useState('');
  const [newArea, setNewArea] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newTime, setNewTime] = useState('14:00 - 15:30');
  const [newDuration, setNewDuration] = useState('1:30:00');
  const [newRpEmpId, setNewRpEmpId] = useState('');
  const [newMode, setNewMode] = useState('Lecture Cum Discussion');
  const [newDescription, setNewDescription] = useState('');
  const [newMaxParticipants, setNewMaxParticipants] = useState(40);
  const [areasList, setAreasList] = useState<string[]>([]);
  const [officersList, setOfficersList] = useState<any[]>([]);

  const { success, error, info } = useToast();
  const isAdmin = user?.role === 'ADMIN';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [clsRes, myAppsRes, areasRes, officersRes] = await Promise.all([
        ApiService.getUpcomingClasses(),
        user ? ApiService.getMyApplications() : Promise.resolve({ success: true, data: [] }),
        ApiService.getAreas(),
        isAdmin ? ApiService.getOfficersDropdown() : Promise.resolve({ success: true, data: [] })
      ]);

      if (clsRes.success && clsRes.data) setClasses(clsRes.data);
      if (myAppsRes.success && myAppsRes.data) setMyApplications(myAppsRes.data);
      if (areasRes.success && areasRes.data) {
        setAreasList(areasRes.data.filter((a) => a.status === 'ACTIVE').map((a) => a.name));
      }
      if (officersRes.success && officersRes.data) setOfficersList(officersRes.data);
    } catch (e: any) {
      error(e?.message || 'Failed to load upcoming classes.');
    } finally {
      setLoading(false);
    }
  };

  const handleApply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!applyingClass) return;

    setIsSubmitting(true);
    try {
      const res = await ApiService.applyForClass(applyingClass.classId, applicationRemarks);
      if (res.success && res.data) {
        success('Your application for this CNE class has been submitted successfully.', 'Application Submitted');
        setMyApplications((prev) => [res.data!, ...prev]);
        setApplyingClass(null);
        setApplicationRemarks('');
        loadData();
      } else {
        error(res.message || 'Application submission failed.');
      }
    } catch (err: any) {
      error(err?.message || 'Error submitting application.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateUpcomingClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTopic.trim() || !newArea.trim() || !newDate.trim()) {
      error('Please fill in all required fields.');
      return;
    }

    const rp = officersList.find((o) => o.employeeId === newRpEmpId);

    setIsSubmitting(true);
    try {
      const res = await ApiService.addUpcomingClass({
        topic: newTopic,
        area: newArea,
        date: newDate,
        time: newTime,
        duration: newDuration,
        resourcePersonEmpId: newRpEmpId,
        resourcePersonName: rp ? rp.name : newRpEmpId,
        modeOfTeaching: newMode,
        description: newDescription,
        maxParticipants: newMaxParticipants,
        status: 'OPEN'
      });

      if (res.success) {
        success('Upcoming CNE workshop created successfully.', 'Class Scheduled');
        setIsAddClassOpen(false);
        // Reset form
        setNewTopic('');
        setNewDescription('');
        loadData();
      } else {
        error(res.message || 'Failed to schedule class.');
      }
    } catch (err: any) {
      error(err?.message || 'Error creating class.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const isClassApplied = (classId: string) => {
    return myApplications.some(
      (a) => a.classId.toLowerCase() === classId.toLowerCase() && a.status !== 'Cancelled'
    );
  };

  const filteredClasses = classes.filter((c) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.toLowerCase();
    return (
      c.topic.toLowerCase().includes(q) ||
      c.area.toLowerCase().includes(q) ||
      (c.resourcePersonName || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Upcoming CNE Workshops & Classes</h1>
          <p className="text-xs text-slate-500 mt-1">
            Register for scheduled clinical skill stations, continuing nursing seminars, and simulation lab workshops.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isAdmin && (
            <button
              id="btn-admin-add-upcoming-class"
              onClick={() => setIsAddClassOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>Schedule New Class</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          id="tab-btn-upcoming-classes"
          onClick={() => setActiveTab('classes')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'classes'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Available Classes ({classes.length})</span>
        </button>

        <button
          id="tab-btn-my-applications"
          onClick={() => setActiveTab('my-applications')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all ${
            activeTab === 'my-applications'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4 text-emerald-600" />
          <span>My Applications ({myApplications.length})</span>
        </button>
      </div>

      {/* Tab Content: Available Classes */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          {/* Search bar */}
          <div className="max-w-md">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search upcoming topic, department, or instructor..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl shadow-xs"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-20 text-center text-xs text-slate-400">Loading upcoming classes...</div>
          ) : filteredClasses.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
              <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No upcoming classes scheduled</h3>
              <p className="text-xs text-slate-500">Check back soon for next week's CNE schedule.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {filteredClasses.map((cls) => {
                const applied = isClassApplied(cls.classId);
                const isFull = (cls.currentApplicationsCount || 0) >= (cls.maxParticipants || 50);

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
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            applied
                              ? 'bg-emerald-100 text-emerald-800'
                              : isFull
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-sky-100 text-sky-800'
                          }`}
                        >
                          {applied ? '✓ Applied' : isFull ? 'Seats Full' : 'Registration Open'}
                        </span>
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
                          <span>{cls.date}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span>{cls.time} ({cls.duration})</span>
                        </div>
                        <div className="flex items-center gap-1.5 col-span-2">
                          <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            Instructor: {cls.resourcePersonName || cls.resourcePersonEmpId}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 pt-3 border-t border-slate-100 flex items-center justify-between">
                      <div className="text-xs text-slate-500 flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-slate-400" />
                        <span>Capacity: {cls.currentApplicationsCount || 0} / {cls.maxParticipants || 50}</span>
                      </div>

                      {applied ? (
                        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-lg">
                          Application Submitted
                        </span>
                      ) : (
                        <button
                          id={`btn-apply-class-${cls.classId}`}
                          onClick={() => {
                            if (!user) {
                              info('Please log in to apply for this CNE class.', 'Authentication Required');
                              if (onRequireLogin) onRequireLogin(cls.classId);
                              return;
                            }
                            setApplyingClass(cls);
                          }}
                          disabled={isFull || cls.status === 'CLOSED'}
                          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                        >
                          Apply for Class
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab Content: My Applications */}
      {activeTab === 'my-applications' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
          {myApplications.length === 0 ? (
            <div className="py-16 text-center space-y-2">
              <FileCheck className="w-8 h-8 text-slate-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">You have no active CNE applications</h3>
              <p className="text-xs text-slate-500">
                Browse available upcoming classes to register for continuing education credit.
              </p>
              <button
                onClick={() => setActiveTab('classes')}
                className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-lg text-xs font-semibold"
              >
                Browse Upcoming Classes
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-3 px-4">Application ID</th>
                    <th className="py-3 px-4">Class Topic</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Applied At</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {myApplications.map((app) => (
                    <tr key={app.applicationId} className="hover:bg-slate-50">
                      <td className="py-3 px-4 font-mono font-medium text-slate-600">
                        {app.applicationId}
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-900">
                        {app.classTopic || `Class ID: ${app.classId}`}
                      </td>
                      <td className="py-3 px-4 text-slate-700 whitespace-nowrap">
                        {app.classDate || 'Scheduled'}
                      </td>
                      <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                        {new Date(app.appliedAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            app.status === 'Approved'
                              ? 'bg-emerald-100 text-emerald-800'
                              : app.status === 'Attended'
                              ? 'bg-purple-100 text-purple-800'
                              : app.status === 'Rejected'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {app.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-500 max-w-xs truncate">
                        {app.remarks || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Modal: Confirm Application */}
      {applyingClass && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setApplyingClass(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-200">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Apply for CNE Class</h3>
                <p className="text-xs text-slate-500">{user.name} ({user.employeeId})</p>
              </div>
            </div>

            <form onSubmit={handleApply} className="space-y-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
                <span className="text-slate-500 font-semibold uppercase text-[10px]">Session Topic</span>
                <p className="text-sm font-bold text-slate-900">{applyingClass.topic}</p>
                <div className="text-slate-600 pt-1 flex items-center justify-between">
                  <span>Area: {applyingClass.area}</span>
                  <span>{applyingClass.date} • {applyingClass.time}</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Optional Remarks / Duty Details
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Duty off / Reliever arranged in ward"
                  value={applicationRemarks}
                  onChange={(e) => setApplicationRemarks(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setApplyingClass(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Submitting...' : 'Confirm Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Admin Schedule Class */}
      {isAddClassOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setIsAddClassOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Schedule Upcoming CNE Class</h3>
                <p className="text-xs text-slate-500">Publish training session for nursing registration</p>
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

              <div className="grid grid-cols-2 gap-3">
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

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Scheduled Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Resource Person / Instructor
                  </label>
                  <select
                    value={newRpEmpId}
                    onChange={(e) => setNewRpEmpId(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Select Officer...</option>
                    {officersList.map((o) => (
                      <option key={o.employeeId} value={o.employeeId}>
                        {o.employeeId} - {o.name} ({o.designation})
                      </option>
                    ))}
                  </select>
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
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Publishing...' : 'Publish Upcoming Class'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

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
  Filter,
  Loader2,
  BookOpen
} from 'lucide-react';
import { CNEApplication, SessionUser, UpcomingClass } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface UpcomingClassesProps {
  user: SessionUser | null;
  defaultTab?: 'classes' | 'my-applications' | 'my-proposals';
  onRequireLogin?: (classId?: string) => void;
}

export const UpcomingClasses: React.FC<UpcomingClassesProps> = ({
  user,
  defaultTab = 'classes',
  onRequireLogin
}) => {
  const [activeTab, setActiveTab] = useState<'classes' | 'my-applications' | 'my-proposals'>(defaultTab);
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [myApplications, setMyApplications] = useState<CNEApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [applyingClass, setApplyingClass] = useState<UpcomingClass | null>(null);
  const [applicationRemarks, setApplicationRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Schedule Class Modal State
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

  const { success, error, info } = useToast();
  const isAdmin = user?.role === 'ADMIN';
  const todayStr = new Date().toISOString().split('T')[0];

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
        user ? ApiService.getOfficersDropdown() : Promise.resolve({ success: true, data: [] })
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
          status: isAdmin ? 'Approved' : 'Pending'
        } as any);

        if (res.success) {
          success(
            isAdmin
              ? 'Upcoming CNE workshop created and published successfully.'
              : 'Upcoming CNE class proposal submitted for Admin approval.',
            isAdmin ? 'Class Scheduled' : 'Proposal Submitted'
          );
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
          error(res.message || 'Failed to schedule class.');
        }
      } catch (err: any) {
        error(err?.message || 'Error creating class.');
      } finally {
        setIsSubmitting(false);
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

  const isClassApplied = (classId: string) => {
    return myApplications.some(
      (a) => a.classId.toLowerCase() === classId.toLowerCase() && a.status !== 'Cancelled'
    );
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

  const myProposedClasses = classes.filter((c) =>
    user ? c.proposedByEmpId === user.employeeId || (isAdmin && Boolean(c.proposedByEmpId)) : false
  );

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
          <h1 className="text-xl font-bold text-slate-900">Upcoming CNE Workshops & Classes</h1>
          <p className="text-xs text-slate-500 mt-1">
            Register for scheduled clinical skill stations, continuing nursing seminars, and simulation lab workshops.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {user && (
            <button
              id="btn-admin-add-upcoming-class"
              onClick={() => setIsAddClassOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer"
            >
              <PlusCircle className="w-4 h-4 text-emerald-400" />
              <span>{isAdmin ? 'Schedule New Class' : 'Propose CNE Class'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto">
        <button
          id="tab-btn-upcoming-classes"
          onClick={() => setActiveTab('classes')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'classes'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span>Available Classes ({availableClasses.length})</span>
        </button>

        <button
          id="tab-btn-my-applications"
          onClick={() => setActiveTab('my-applications')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
            activeTab === 'my-applications'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileCheck className="w-4 h-4 text-emerald-600" />
          <span>My Applications ({myApplications.length})</span>
        </button>

        {user && (
          <button
            id="tab-btn-my-proposals"
            onClick={() => setActiveTab('my-proposals')}
            className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'my-proposals'
                ? 'border-slate-900 text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4 text-purple-600" />
            <span>My Proposed Classes ({myProposedClasses.length})</span>
          </button>
        )}
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
          ) : availableClasses.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
              <Sparkles className="w-8 h-8 text-amber-500 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No upcoming classes scheduled</h3>
              <p className="text-xs text-slate-500">Check back soon for next week's CNE schedule.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {availableClasses.map((cls) => {
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
                        <div className="flex items-center gap-1.5">
                          {cls.status && cls.status.toUpperCase() !== 'APPROVED' && cls.status.toUpperCase() !== 'OPEN' && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                              {cls.status}
                            </span>
                          )}
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
                          <span>{cls.time} ({cls.duration})</span>
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

      {/* Tab Content: My Proposed Classes */}
      {activeTab === 'my-proposals' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Your Submitted CNE Proposals</h2>
              <p className="text-xs text-slate-500">
                Track administrator review status, approval outcomes, and administrative remarks for your proposed classes.
              </p>
            </div>
            <button
              onClick={() => setIsAddClassOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-bold hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            >
              <PlusCircle className="w-3.5 h-3.5 text-emerald-400" />
              <span>Propose New Class</span>
            </button>
          </div>

          {loading ? (
            <div className="py-16 text-center text-xs text-slate-400">Loading your proposed classes...</div>
          ) : myProposedClasses.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-2xl border border-slate-200 p-8 space-y-2">
              <BookOpen className="w-8 h-8 text-purple-400 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">No CNE Class Proposals Yet</h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                You have not submitted any CNE class proposals. Click "Propose New Class" to submit a topic and schedule for administrator review.
              </p>
              <button
                onClick={() => setIsAddClassOpen(true)}
                className="mt-3 px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold hover:bg-slate-800 cursor-pointer"
              >
                + Propose CNE Class
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {myProposedClasses.map((cls) => {
                const statusUpper = (cls.status || 'PENDING').toUpperCase();
                const isApproved = statusUpper === 'APPROVED' || statusUpper === 'OPEN';
                const isRejected = statusUpper === 'REJECTED';
                const isPending = !isApproved && !isRejected;

                return (
                  <div
                    key={cls.classId}
                    className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition-all space-y-3"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            Proposal ID: {cls.classId}
                          </span>
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                            {cls.area}
                          </span>
                        </div>
                        <h3 className="text-base font-bold text-slate-900 mt-1">{cls.topic}</h3>
                      </div>

                      <div className="flex items-center gap-2 self-start sm:self-auto">
                        <span
                          className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : isRejected
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {isApproved ? (
                            <>
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Approved</span>
                            </>
                          ) : isRejected ? (
                            <>
                              <AlertCircle className="w-3.5 h-3.5" />
                              <span>Rejected</span>
                            </>
                          ) : (
                            <>
                              <Clock className="w-3.5 h-3.5" />
                              <span>Pending Admin Review</span>
                            </>
                          )}
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-700 block">Date(s):</span>
                          <span>
                            {cls.toDate && cls.toDate !== cls.date
                              ? `${cls.date} to ${cls.toDate}`
                              : cls.date}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-700 block">Time & Duration:</span>
                          <span>{cls.time} ({cls.duration})</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <div>
                          <span className="font-semibold text-slate-700 block">Instructor(s):</span>
                          <span className="line-clamp-1">{getResourcePersonsDisplay(cls)}</span>
                        </div>
                      </div>
                    </div>

                    {cls.description && (
                      <p className="text-xs text-slate-600 bg-slate-50/70 p-2.5 rounded-lg border border-slate-100">
                        <span className="font-semibold text-slate-700">Course Outline:</span> {cls.description}
                      </p>
                    )}

                    {/* Administrator Remarks */}
                    <div className="pt-2 border-t border-slate-100">
                      {cls.adminRemarks ? (
                        <div
                          className={`p-3 rounded-xl border text-xs ${
                            isApproved
                              ? 'bg-emerald-50/50 border-emerald-200 text-emerald-950'
                              : isRejected
                              ? 'bg-rose-50/50 border-rose-200 text-rose-950'
                              : 'bg-slate-50 border-slate-200 text-slate-800'
                          }`}
                        >
                          <div className="font-bold text-[11px] uppercase tracking-wider mb-1 flex items-center gap-1.5">
                            <span>Administrator Remarks & Instructions</span>
                          </div>
                          <p className="leading-relaxed font-medium">{cls.adminRemarks}</p>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">
                          {isPending
                            ? 'Awaiting review and remarks from the Nursing Education Administration.'
                            : 'No administrator remarks provided.'}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
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
              disabled={isSubmitting}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 disabled:opacity-40 cursor-pointer"
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
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Confirm Application</span>
                  )}
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
                  {isAdmin ? 'Schedule Upcoming CNE Class' : 'Propose Upcoming CNE Class'}
                </h3>
                <p className="text-xs text-slate-500">
                  {isAdmin
                    ? 'Publish training session for nursing registration'
                    : 'Submit workshop proposal for Admin review and approval'}
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
                      <span>{isAdmin ? 'Publishing...' : 'Submitting Proposal...'}</span>
                    </>
                  ) : (
                    <span>{isAdmin ? 'Publish Upcoming Class' : 'Submit Proposal for Approval'}</span>
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

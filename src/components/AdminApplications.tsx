import React, { useState, useEffect } from 'react';
import {
  ClipboardList,
  CheckCircle2,
  XCircle,
  Clock,
  UserCheck,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  Calendar,
  Sparkles,
  BookOpen,
  User,
  X
} from 'lucide-react';
import { CNEApplication, SessionUser, UpcomingClass } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AdminApplicationsProps {
  user: SessionUser;
}

export const AdminApplications: React.FC<AdminApplicationsProps> = () => {
  const [activeTab, setActiveTab] = useState<'applications' | 'classes'>('applications');
  const [applications, setApplications] = useState<CNEApplication[]>([]);
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [classStatusFilter, setClassStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

  // Class review states
  const [reviewingClassId, setReviewingClassId] = useState<string | null>(null);
  const [reviewModal, setReviewModal] = useState<{
    classItem: UpcomingClass;
    action: 'Approved' | 'Rejected';
  } | null>(null);
  const [reviewRemarks, setReviewRemarks] = useState('');

  const { success, error } = useToast();

  useEffect(() => {
    loadApplications();
  }, []);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const [appsRes, clsRes] = await Promise.all([
        ApiService.getAllApplications(),
        ApiService.getUpcomingClasses()
      ]);

      if (appsRes.success && appsRes.data) setApplications(appsRes.data);
      if (clsRes.success && clsRes.data) setClasses(clsRes.data);
    } catch (e: any) {
      error('Failed to load applications and classes.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (
    applicationId: string,
    newStatus: CNEApplication['status']
  ) => {
    if (updatingAppId) return;
    setUpdatingAppId(applicationId);
    try {
      const res = await ApiService.updateApplicationStatus(applicationId, newStatus);
      if (res.success) {
        success(`Application ${applicationId} marked as ${newStatus}.`, 'Status Updated');
        setApplications((prev) =>
          prev.map((a) => (a.applicationId === applicationId ? { ...a, status: newStatus } : a))
        );
      } else {
        error(res.message || 'Failed to update status.');
      }
    } catch (err: any) {
      error('Error updating status.');
    } finally {
      setUpdatingAppId(null);
    }
  };

  const handleReviewClass = async (
    classId: string,
    status: 'Approved' | 'Rejected',
    remarks?: string
  ) => {
    if (reviewingClassId) return;
    setReviewingClassId(classId);
    try {
      const res = await ApiService.reviewUpcomingClass(classId, status, remarks);
      if (res.success) {
        success(`Class proposal ${classId} has been ${status.toLowerCase()}.`, 'Class Proposal Reviewed');
        setClasses((prev) =>
          prev.map((c) =>
            c.classId === classId ? { ...c, status, adminRemarks: remarks || c.adminRemarks } : c
          )
        );
        setReviewModal(null);
        setReviewRemarks('');
      } else {
        error(res.message || `Failed to ${status.toLowerCase()} class proposal.`);
      }
    } catch (err: any) {
      error(err?.message || 'Error reviewing class proposal.');
    } finally {
      setReviewingClassId(null);
    }
  };

  const pendingClassesCount = classes.filter(
    (c) => (c.status || '').toUpperCase() === 'PENDING'
  ).length;

  const filteredApplications = applications.filter((app) => {
    if (statusFilter !== 'ALL' && app.status !== statusFilter) return false;
    if (classFilter !== 'ALL' && app.classId !== classFilter) return false;

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        app.applicationId.toLowerCase().includes(q) ||
        app.employeeId.toLowerCase().includes(q) ||
        (app.employeeName || '').toLowerCase().includes(q) ||
        (app.classTopic || '').toLowerCase().includes(q)
      );
    }

    return true;
  });

  const filteredClasses = classes.filter((c) => {
    if (classStatusFilter !== 'ALL') {
      if ((c.status || '').toUpperCase() !== classStatusFilter.toUpperCase()) return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      return (
        c.classId.toLowerCase().includes(q) ||
        c.topic.toLowerCase().includes(q) ||
        c.area.toLowerCase().includes(q) ||
        (c.resourcePersonName || '').toLowerCase().includes(q) ||
        (c.proposedByName || '').toLowerCase().includes(q) ||
        (c.proposedByEmpId || '').toLowerCase().includes(q)
      );
    }

    return true;
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">CNE Class Registrations & Approvals</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">
              Applications: {applications.length}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review and approve staff applications for upcoming workshops, seminars, and clinical skills stations.
          </p>
        </div>

        <button
          onClick={loadApplications}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          id="tab-btn-admin-applications"
          onClick={() => setActiveTab('applications')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'applications'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardList className="w-4 h-4 text-slate-600" />
          <span>Staff Applications ({applications.length})</span>
        </button>

        <button
          id="tab-btn-admin-class-proposals"
          onClick={() => setActiveTab('classes')}
          className={`pb-3 px-4 text-xs font-bold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
            activeTab === 'classes'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4 text-purple-600" />
          <span>Class Proposals & Scheduling ({classes.length})</span>
          {pendingClassesCount > 0 && (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-500 text-white font-bold">
              {pendingClassesCount} Pending
            </span>
          )}
        </button>
      </div>

      {/* Tab 1: Staff Applications */}
      {activeTab === 'applications' && (
        <div className="space-y-4">
          {/* Filter Ribbon */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search candidate name, ID, topic..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium"
              >
                <option value="ALL">All Scheduled Classes</option>
                {classes.map((c) => (
                  <option key={c.classId} value={c.classId}>
                    {c.topic} ({c.date})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium"
              >
                <option value="ALL">All Statuses</option>
                <option value="Applied">Applied (Pending)</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
                <option value="Attended">Attended</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>
          </div>

          {/* Applications Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-xs text-slate-400">Loading applications...</div>
            ) : filteredApplications.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <ClipboardList className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No applications match your filters</h3>
                <p className="text-xs text-slate-500">Applications submitted by nursing staff will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                      <th className="py-3 px-4">App ID</th>
                      <th className="py-3 px-4">Applicant Staff</th>
                      <th className="py-3 px-4">Workshop Topic</th>
                      <th className="py-3 px-4">Applied Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Review Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredApplications.map((app) => (
                      <tr key={app.applicationId} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {app.applicationId}
                        </td>

                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{app.employeeName || app.employeeId}</div>
                          <div className="text-[11px] text-slate-500 font-mono">ID: {app.employeeId}</div>
                        </td>

                        <td className="py-3 px-4 max-w-xs">
                          <div className="font-semibold text-slate-900">{app.classTopic || `Class ID: ${app.classId}`}</div>
                          <div className="text-[11px] text-slate-500">Date: {app.classDate || 'Scheduled'}</div>
                        </td>

                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap">
                          {new Date(app.appliedAt).toLocaleDateString()}
                        </td>

                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
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

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {updatingAppId === app.applicationId ? (
                              <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                                <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                                <span>Updating...</span>
                              </div>
                            ) : (
                              <>
                                {app.status !== 'Approved' && (
                                  <button
                                    onClick={() => handleUpdateStatus(app.applicationId, 'Approved')}
                                    disabled={updatingAppId !== null}
                                    className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold text-[11px] disabled:opacity-40 cursor-pointer"
                                    title="Approve candidate"
                                  >
                                    Approve
                                  </button>
                                )}

                                {app.status !== 'Attended' && (
                                  <button
                                    onClick={() => handleUpdateStatus(app.applicationId, 'Attended')}
                                    disabled={updatingAppId !== null}
                                    className="px-2.5 py-1 bg-purple-50 text-purple-700 hover:bg-purple-100 rounded font-semibold text-[11px] disabled:opacity-40 cursor-pointer"
                                    title="Mark as Attended & completed"
                                  >
                                    Attended
                                  </button>
                                )}

                                {app.status !== 'Rejected' && (
                                  <button
                                    onClick={() => handleUpdateStatus(app.applicationId, 'Rejected')}
                                    disabled={updatingAppId !== null}
                                    className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded font-semibold text-[11px] disabled:opacity-40 cursor-pointer"
                                    title="Reject candidate"
                                  >
                                    Reject
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Class Proposals & Approvals */}
      {activeTab === 'classes' && (
        <div className="space-y-4">
          {/* Filter Ribbon */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Search class topic, ward, instructor, proposer..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg"
              />
            </div>

            <div>
              <select
                value={classStatusFilter}
                onChange={(e) => setClassStatusFilter(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium"
              >
                <option value="ALL">All Class Statuses</option>
                <option value="PENDING">Pending Approval</option>
                <option value="APPROVED">Approved / Open</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>
          </div>

          {/* Classes Table */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            {loading ? (
              <div className="py-20 text-center text-xs text-slate-400">Loading scheduled classes...</div>
            ) : filteredClasses.length === 0 ? (
              <div className="py-16 text-center space-y-2">
                <BookOpen className="w-8 h-8 text-slate-400 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">No class proposals found</h3>
                <p className="text-xs text-slate-500">Upcoming classes and proposals submitted by staff will appear here.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                      <th className="py-3 px-4">Class ID</th>
                      <th className="py-3 px-4">Topic & Ward</th>
                      <th className="py-3 px-4">Schedule</th>
                      <th className="py-3 px-4">Instructors / Resource Persons</th>
                      <th className="py-3 px-4">Proposed By</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Approval Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredClasses.map((cls) => {
                      const isPending = (cls.status || '').toUpperCase() === 'PENDING';
                      const isApproved = (cls.status || '').toUpperCase() === 'APPROVED' || (cls.status || '').toUpperCase() === 'OPEN';
                      const isRejected = (cls.status || '').toUpperCase() === 'REJECTED';

                      return (
                        <tr key={cls.classId} className="hover:bg-slate-50">
                          <td className="py-3 px-4 font-mono font-bold text-slate-700 whitespace-nowrap">
                            {cls.classId}
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-bold text-slate-900">{cls.topic}</div>
                            <div className="text-[11px] text-slate-500">{cls.area} • {cls.modeOfTeaching}</div>
                            {cls.description && (
                              <div className="text-[10px] text-slate-400 mt-0.5 line-clamp-1">{cls.description}</div>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            <div className="flex items-center gap-1 text-slate-800 font-medium">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span>
                                {cls.toDate && cls.toDate !== cls.date
                                  ? `${cls.date} to ${cls.toDate}`
                                  : cls.date}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {cls.time} ({cls.duration})
                            </div>
                          </td>

                          <td className="py-3 px-4 max-w-xs">
                            <div className="font-medium text-slate-800">
                              {cls.resourcePersonName || cls.resourcePersonEmpId || 'None (Internal)'}
                            </div>
                            {cls.externalResourcePersons && cls.externalResourcePersons.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {cls.externalResourcePersons.map((ext, idx) => (
                                  <span
                                    key={idx}
                                    className="px-1.5 py-0.5 bg-amber-50 text-amber-900 border border-amber-200 rounded text-[10px]"
                                  >
                                    {ext} (Ext)
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          <td className="py-3 px-4 whitespace-nowrap">
                            {cls.proposedByName || cls.proposedByEmpId ? (
                              <div>
                                <div className="font-medium text-slate-900">{cls.proposedByName || cls.proposedByEmpId}</div>
                                {cls.proposedByEmpId && (
                                  <div className="text-[11px] text-slate-500 font-mono">ID: {cls.proposedByEmpId}</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Institutional (Admin)</span>
                            )}
                          </td>

                          <td className="py-3 px-4">
                            <div>
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                  isApproved
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : isRejected
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-amber-100 text-amber-800'
                                }`}
                              >
                                {cls.status}
                              </span>
                              {cls.adminRemarks && (
                                <div className="text-[10px] text-slate-500 mt-1 italic max-w-xs">
                                  Note: {cls.adminRemarks}
                                </div>
                              )}
                            </div>
                          </td>

                          <td className="py-3 px-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              {reviewingClassId === cls.classId ? (
                                <div className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 rounded text-[11px] font-semibold">
                                  <Loader2 className="w-3 h-3 animate-spin text-emerald-600" />
                                  <span>Processing...</span>
                                </div>
                              ) : (
                                <>
                                  {!isApproved && (
                                    <button
                                      onClick={() => {
                                        setReviewModal({ classItem: cls, action: 'Approved' });
                                        setReviewRemarks(cls.adminRemarks || '');
                                      }}
                                      disabled={reviewingClassId !== null}
                                      className="px-2.5 py-1 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded font-semibold text-[11px] disabled:opacity-40 cursor-pointer"
                                      title="Approve and publish proposal"
                                    >
                                      Approve
                                    </button>
                                  )}

                                  {!isRejected && (
                                    <button
                                      onClick={() => {
                                        setReviewModal({ classItem: cls, action: 'Rejected' });
                                        setReviewRemarks(cls.adminRemarks || '');
                                      }}
                                      disabled={reviewingClassId !== null}
                                      className="px-2.5 py-1 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded font-semibold text-[11px] disabled:opacity-40 cursor-pointer"
                                      title="Reject proposal"
                                    >
                                      Reject
                                    </button>
                                  )}
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Review Modal (Approve or Reject with Remarks) */}
      {reviewModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 relative">
            <button
              onClick={() => setReviewModal(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  reviewModal.action === 'Approved'
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-rose-100 text-rose-700'
                }`}
              >
                {reviewModal.action === 'Approved' ? (
                  <CheckCircle2 className="w-5 h-5" />
                ) : (
                  <XCircle className="w-5 h-5" />
                )}
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {reviewModal.action === 'Approved' ? 'Approve CNE Class' : 'Reject Class Proposal'}
                </h3>
                <p className="text-xs text-slate-500">Proposal ID: {reviewModal.classItem.classId}</p>
              </div>
            </div>

            <p className="text-xs text-slate-700 mb-3">
              {reviewModal.action === 'Approved'
                ? 'Approve and publish this scheduled CNE class for registration:'
                : 'Are you sure you want to reject this proposed class:'}
              <strong className="block text-slate-900 mt-1">{reviewModal.classItem.topic}</strong>
              <span className="text-[11px] text-slate-500 block mt-0.5">
                Area: {reviewModal.classItem.area} | Date: {reviewModal.classItem.date}
              </span>
            </p>

            <div className="space-y-1.5 mb-4">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                Administrator Remarks & Instructions
              </label>
              <textarea
                rows={3}
                value={reviewRemarks}
                onChange={(e) => setReviewRemarks(e.target.value)}
                placeholder={
                  reviewModal.action === 'Approved'
                    ? 'Add instructions, venue details, or remarks (optional)...'
                    : 'Specify reason or feedback for rejection...'
                }
                className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setReviewModal(null)}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium text-xs cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() =>
                  handleReviewClass(
                    reviewModal.classItem.classId,
                    reviewModal.action,
                    reviewRemarks.trim()
                  )
                }
                className={`px-4 py-2 text-white rounded-lg font-bold text-xs cursor-pointer ${
                  reviewModal.action === 'Approved'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-rose-600 hover:bg-rose-700'
                }`}
              >
                {reviewModal.action === 'Approved' ? 'Confirm Approval' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

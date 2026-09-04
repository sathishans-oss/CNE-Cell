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
  Loader2
} from 'lucide-react';
import { CNEApplication, SessionUser, UpcomingClass } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AdminApplicationsProps {
  user: SessionUser;
}

export const AdminApplications: React.FC<AdminApplicationsProps> = () => {
  const [applications, setApplications] = useState<CNEApplication[]>([]);
  const [classes, setClasses] = useState<UpcomingClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [updatingAppId, setUpdatingAppId] = useState<string | null>(null);

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
      error('Failed to load applications.');
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
  );
};

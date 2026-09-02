import React, { useState, useEffect, useMemo } from 'react';
import {
  Database,
  PlusCircle,
  Search,
  Filter,
  Edit2,
  Trash2,
  Check,
  X,
  Clock,
  Download,
  Users,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { Area, CNERecord, Employee, SessionUser } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';

interface AdminCNEDataProps {
  user: SessionUser;
  isOpenAddModalDefault?: boolean;
}

export const AdminCNEData: React.FC<AdminCNEDataProps> = ({
  user,
  isOpenAddModalDefault = false
}) => {
  const [records, setRecords] = useState<CNERecord[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [officers, setOfficers] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Add CNE Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(isOpenAddModalDefault);
  const [formArea, setFormArea] = useState('');
  const [formFromDate, setFormFromDate] = useState(new Date().toISOString().split('T')[0]);
  const [formToDate, setFormToDate] = useState(new Date().toISOString().split('T')[0]);
  const [formDuration, setFormDuration] = useState('1:00:00');
  const [formTopic, setFormTopic] = useState('');
  const [formRpEmpId, setFormRpEmpId] = useState('');
  const [formMode, setFormMode] = useState('Lecture Cum Discussion');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Inline Edit State
  const [editingDataId, setEditingDataId] = useState<string | null>(null);
  const [inlineForm, setInlineForm] = useState<Partial<CNERecord>>({});

  // Delete Confirm Modal State
  const [deletingRecord, setDeletingRecord] = useState<CNERecord | null>(null);

  const { success, error } = useToast();

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [recordsRes, areasRes, officersRes] = await Promise.all([
        ApiService.getCNERecords(),
        ApiService.getAreas(),
        ApiService.getOfficersDropdown()
      ]);

      if (recordsRes.success && recordsRes.data) setRecords(recordsRes.data);
      if (areasRes.success && areasRes.data) setAreas(areasRes.data);
      if (officersRes.success && officersRes.data) setOfficers(officersRes.data);
    } catch (e: any) {
      error(e?.message || 'Error loading CNE master data.');
    } finally {
      setLoading(false);
    }
  };

  // Filtered list
  const filteredRecords = useMemo(() => {
    return records.filter((rec) => {
      if (selectedArea && rec.area !== selectedArea) return false;
      if (startDate && rec.fromDate < startDate) return false;
      if (endDate && rec.fromDate > endDate) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchId = rec.dataId.toLowerCase().includes(q);
        const matchTopic = rec.topic.toLowerCase().includes(q);
        const matchArea = rec.area.toLowerCase().includes(q);
        const matchRp = (rec.resourcePersonName || rec.resourcePersonEmpId).toLowerCase().includes(q);
        const matchRemarks = (rec.remarks || '').toLowerCase().includes(q);
        const matchStaff = (rec.staffEmpIds || []).some((s) => s.toLowerCase().includes(q));

        if (!matchId && !matchTopic && !matchArea && !matchRp && !matchRemarks && !matchStaff) {
          return false;
        }
      }

      return true;
    });
  }, [records, selectedArea, startDate, endDate, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  // Handle Add CNE
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTopic.trim() || !formArea.trim() || !formFromDate.trim() || !formRpEmpId.trim()) {
      error('Please complete all required fields (Topic, Area, Date, Resource Person).');
      return;
    }

    if (formToDate && formToDate < formFromDate) {
      error('To Date cannot be earlier than From Date.');
      return;
    }

    const rp = officers.find((o) => o.employeeId === formRpEmpId);

    setIsSubmitting(true);
    try {
      const res = await ApiService.addCNE({
        area: formArea,
        fromDate: formFromDate,
        toDate: formToDate || formFromDate,
        duration: formDuration || '1:00:00',
        topic: formTopic.trim(),
        resourcePersonEmpId: formRpEmpId,
        resourcePersonName: rp ? rp.name : formRpEmpId,
        modeOfTeaching: formMode,
        staffEmpIds: selectedStaffIds,
        staffCount: selectedStaffIds.length,
        remarks: formRemarks.trim()
      });

      if (res.success && res.data) {
        success('CNE activity recorded and saved successfully.', 'Activity Added');
        setRecords((prev) => [res.data!, ...prev]);
        setIsAddModalOpen(false);
        // Reset form
        setFormTopic('');
        setSelectedStaffIds([]);
        setFormRemarks('');
      } else {
        error(res.message || 'Failed to save CNE record.');
      }
    } catch (err: any) {
      error(err?.message || 'Error saving record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Inline Edit Start
  const startInlineEdit = (rec: CNERecord) => {
    setEditingDataId(rec.dataId);
    setInlineForm({ ...rec });
  };

  const cancelInlineEdit = () => {
    setEditingDataId(null);
    setInlineForm({});
  };

  const saveInlineEdit = async (dataId: string) => {
    try {
      const res = await ApiService.updateCNE(dataId, inlineForm);

      if (res.success) {
        success('CNE record updated successfully.', 'Record Updated');
        setRecords((prev) =>
          prev.map((r) => (r.dataId === dataId ? { ...r, ...inlineForm } as CNERecord : r))
        );
        cancelInlineEdit();
      } else {
        error(res.message || 'Failed to update record.');
      }
    } catch (err: any) {
      error(err?.message || 'Error updating record.');
    }
  };

  // Delete action
  const confirmDelete = async () => {
    if (!deletingRecord) return;
    try {
      const res = await ApiService.deleteCNE(deletingRecord.dataId);
      if (res.success) {
        success('CNE record deleted successfully.', 'Record Deleted');
        setRecords((prev) => prev.filter((r) => r.dataId !== deletingRecord.dataId));
        setDeletingRecord(null);
      } else {
        error(res.message || 'Failed to delete record.');
      }
    } catch (err: any) {
      error(err?.message || 'Error deleting record.');
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (records.length === 0) return;
    const headers = ['Data ID', 'Ward Name / Area', 'From Date', 'To Date', 'Duration', 'Topic', 'Resource Person Emp Id', 'Mode of Teaching', 'Staff Emp ID', 'Staff Count', 'Remarks'];
    const rows = records.map((r) => [
      `"${r.dataId}"`,
      `"${r.area}"`,
      `"${r.fromDate}"`,
      `"${r.toDate || ''}"`,
      `"${r.duration}"`,
      `"${(r.topic || '').replace(/"/g, '""')}"`,
      `"${r.resourcePersonEmpId}"`,
      `"${r.modeOfTeaching}"`,
      `"${(r.staffEmpIds || []).join(', ')}"`,
      `"${r.staffCount}"`,
      `"${(r.remarks || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `CNE_Data_Master_AIIMS_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const teachingModes = [
    'Lecture Cum Discussion',
    'Hands-on Workshop',
    'Clinical Case Discussion',
    'Skill Demonstration',
    'Simulation & Lab Drill',
    'Bedside Clinical Teaching',
    'Journal Club / Seminar'
  ];

  const activeAreas = areas.filter((a) => a.status === 'ACTIVE');

  // Filter officers for staff multi-select
  const filteredStaffOptions = officers.filter((o) => {
    if (!staffSearchQuery.trim()) return true;
    const q = staffSearchQuery.toLowerCase();
    return o.name.toLowerCase().includes(q) || o.employeeId.toLowerCase().includes(q) || o.designation.toLowerCase().includes(q);
  });

  const toggleStaffSelection = (empId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header Bar */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">CNE Data Master</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full font-semibold bg-purple-100 text-purple-800">
              Admin Management
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Complete institutional repository of all Continuing Nursing Education sessions, training hours, and staff participant attendance.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors"
            title="Refresh from Google Sheets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="btn-admin-export-csv"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </button>

          <button
            id="btn-admin-open-add-cne"
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Add CNE Activity</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search topic, Data ID, instructor, staff ID..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:bg-white"
            />
          </div>

          {/* Area Filter */}
          <div>
            <select
              value={selectedArea}
              onChange={(e) => {
                setSelectedArea(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
            >
              <option value="">All Clinical Areas ({areas.length})</option>
              {areas.map((a) => (
                <option key={a.id} value={a.name}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              title="From Date"
            />
          </div>

          {/* To Date */}
          <div>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700"
              title="To Date"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            Showing {filteredRecords.length} of {records.length} records
          </span>
          {(searchTerm || selectedArea || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedArea('');
                setStartDate('');
                setEndDate('');
                setCurrentPage(1);
              }}
              className="text-xs text-rose-600 hover:underline"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-xs text-slate-400">Loading CNE records...</div>
        ) : filteredRecords.length === 0 ? (
          <div className="py-16 text-center space-y-2">
            <Database className="w-8 h-8 text-slate-400 mx-auto" />
            <h3 className="text-sm font-bold text-slate-800">No CNE activities found</h3>
            <p className="text-xs text-slate-500">Try adjusting your search criteria or add a new record.</p>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase text-[11px]">
                    <th className="py-3 px-3 w-28">Data ID</th>
                    <th className="py-3 px-3">Date</th>
                    <th className="py-3 px-3">Ward / Area</th>
                    <th className="py-3 px-3 min-w-[200px]">Topic / Subject</th>
                    <th className="py-3 px-3">Resource Person</th>
                    <th className="py-3 px-3">Mode</th>
                    <th className="py-3 px-3 text-center">Participants</th>
                    <th className="py-3 px-3 text-center">Duration</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.map((rec) => {
                    const isEditing = editingDataId === rec.dataId;

                    return (
                      <tr key={rec.dataId} className={`hover:bg-slate-50 ${isEditing ? 'bg-amber-50/50' : ''}`}>
                        {/* Data ID (Read-only) */}
                        <td className="py-3 px-3 font-mono font-bold text-slate-700 whitespace-nowrap">
                          {rec.dataId}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-800">
                          {isEditing ? (
                            <input
                              type="date"
                              value={inlineForm.fromDate || ''}
                              onChange={(e) => setInlineForm({ ...inlineForm, fromDate: e.target.value })}
                              className="p-1 bg-white border border-slate-300 rounded text-xs"
                            />
                          ) : (
                            rec.fromDate
                          )}
                        </td>

                        {/* Area */}
                        <td className="py-3 px-3 text-slate-700">
                          {isEditing ? (
                            <select
                              value={inlineForm.area || ''}
                              onChange={(e) => setInlineForm({ ...inlineForm, area: e.target.value })}
                              className="p-1 bg-white border border-slate-300 rounded text-xs max-w-[150px]"
                            >
                              {activeAreas.map((a) => (
                                <option key={a.id} value={a.name}>{a.name}</option>
                              ))}
                            </select>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 truncate inline-block max-w-[160px]">
                              {rec.area}
                            </span>
                          )}
                        </td>

                        {/* Topic */}
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={inlineForm.topic || ''}
                              onChange={(e) => setInlineForm({ ...inlineForm, topic: e.target.value })}
                              className="p-1 bg-white border border-slate-300 rounded text-xs w-full"
                            />
                          ) : (
                            rec.topic
                          )}
                        </td>

                        {/* Resource Person */}
                        <td className="py-3 px-3 text-slate-700 whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={inlineForm.resourcePersonEmpId || ''}
                              onChange={(e) => {
                                const rp = officers.find((o) => o.employeeId === e.target.value);
                                setInlineForm({
                                  ...inlineForm,
                                  resourcePersonEmpId: e.target.value,
                                  resourcePersonName: rp ? rp.name : e.target.value
                                });
                              }}
                              className="p-1 bg-white border border-slate-300 rounded text-xs max-w-[140px]"
                            >
                              {officers.map((o) => (
                                <option key={o.employeeId} value={o.employeeId}>
                                  {o.name} ({o.employeeId})
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span>{rec.resourcePersonName || rec.resourcePersonEmpId}</span>
                          )}
                        </td>

                        {/* Mode */}
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {isEditing ? (
                            <select
                              value={inlineForm.modeOfTeaching || ''}
                              onChange={(e) => setInlineForm({ ...inlineForm, modeOfTeaching: e.target.value })}
                              className="p-1 bg-white border border-slate-300 rounded text-xs"
                            >
                              {teachingModes.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                          ) : (
                            rec.modeOfTeaching
                          )}
                        </td>

                        {/* Staff Count */}
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                            {rec.staffCount || (rec.staffEmpIds ? rec.staffEmpIds.length : 0)}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-slate-600">
                          {isEditing ? (
                            <input
                              type="text"
                              value={inlineForm.duration || ''}
                              onChange={(e) => setInlineForm({ ...inlineForm, duration: e.target.value })}
                              className="p-1 bg-white border border-slate-300 rounded text-xs w-20 text-center"
                            />
                          ) : (
                            rec.duration || '1:00:00'
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => saveInlineEdit(rec.dataId)}
                                className="p-1.5 text-emerald-700 hover:bg-emerald-100 rounded-md"
                                title="Save changes"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelInlineEdit}
                                className="p-1.5 text-rose-700 hover:bg-rose-100 rounded-md"
                                title="Cancel"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => startInlineEdit(rec)}
                                className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md"
                                title="Inline Edit"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setDeletingRecord(rec)}
                                className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md"
                                title="Delete record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
              <div>
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Add CNE Activity Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <PlusCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Add CNE Activity Record</h3>
                <p className="text-xs text-slate-500">Logs session into CNE Google Sheet database</p>
              </div>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-4 text-xs">
              {/* Topic */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  CNE Topic / Skills Description *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Nursing management patient with Glaucoma (Skills: Instillation of Eye Drops)"
                  value={formTopic}
                  onChange={(e) => setFormTopic(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              {/* Area & Mode */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Ward Name / Area *
                  </label>
                  <select
                    required
                    value={formArea}
                    onChange={(e) => setFormArea(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    <option value="">Select Ward / Area...</option>
                    {activeAreas.map((a) => (
                      <option key={a.id} value={a.name}>{a.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Mode of Teaching
                  </label>
                  <select
                    value={formMode}
                    onChange={(e) => setFormMode(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  >
                    {teachingModes.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dates & Duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    From Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={formFromDate}
                    onChange={(e) => setFormFromDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={formToDate}
                    onChange={(e) => setFormToDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    Duration (hh:mm:ss)
                  </label>
                  <input
                    type="text"
                    placeholder="1:00:00"
                    value={formDuration}
                    onChange={(e) => setFormDuration(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* Resource Person */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Resource Person (Instructor) *
                </label>
                <select
                  required
                  value={formRpEmpId}
                  onChange={(e) => setFormRpEmpId(e.target.value)}
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                >
                  <option value="">Select Resource Person...</option>
                  {officers.map((o) => (
                    <option key={o.employeeId} value={o.employeeId}>
                      {o.employeeId} — {o.name} ({o.designation})
                    </option>
                  ))}
                </select>
              </div>

              {/* Section 14: Searchable Staff Selection (Multi-select) */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Staff Participants (Multi-Select)
                  </label>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Selected Count: {selectedStaffIds.length}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter staff by name or employee ID..."
                    value={staffSearchQuery}
                    onChange={(e) => setStaffSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* Selected staff chips */}
                {selectedStaffIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                    {selectedStaffIds.map((id) => {
                      const off = officers.find((o) => o.employeeId === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-300"
                        >
                          <span>{id} — {off ? off.name : ''}</span>
                          <button
                            type="button"
                            onClick={() => toggleStaffSelection(id)}
                            className="hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* Staff Selection List */}
                <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                  {filteredStaffOptions.slice(0, 15).map((o) => {
                    const isSelected = selectedStaffIds.includes(o.employeeId);
                    return (
                      <div
                        key={o.employeeId}
                        onClick={() => toggleStaffSelection(o.employeeId)}
                        className={`p-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer text-xs ${
                          isSelected ? 'bg-emerald-50/60 font-semibold' : ''
                        }`}
                      >
                        <div>
                          <span className="font-mono text-slate-600">{o.employeeId}</span>
                          <span className="mx-1.5">•</span>
                          <span className="text-slate-900">{o.name}</span>
                          <span className="text-slate-400 text-[10px] ml-1">({o.designation})</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="rounded text-emerald-600"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={formRemarks}
                  onChange={(e) => setFormRemarks(e.target.value)}
                  placeholder="Additional skills notes, simulation equipment used..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving Activity...' : 'Save CNE Activity'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete CNE Activity?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete <strong className="text-slate-800 font-mono">{deletingRecord.dataId}</strong>? This will remove participation records from connected staff portfolios.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeletingRecord(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg"
              >
                Yes, Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

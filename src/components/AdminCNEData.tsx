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
  RefreshCw,
  Loader2,
  UserCheck
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
  const [selectedRpEmpIds, setSelectedRpEmpIds] = useState<string[]>([]);
  const [rpSearchQuery, setRpSearchQuery] = useState('');
  const [formMode, setFormMode] = useState('Lecture Cum Discussion');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit CNE Modal State (Replacing Inline Edit)
  const [editingRecord, setEditingRecord] = useState<CNERecord | null>(null);
  const [editArea, setEditArea] = useState('');
  const [editFromDate, setEditFromDate] = useState('');
  const [editToDate, setEditToDate] = useState('');
  const [editDuration, setEditDuration] = useState('1:00:00');
  const [editTopic, setEditTopic] = useState('');
  const [editRpEmpIds, setEditRpEmpIds] = useState<string[]>([]);
  const [editRpSearchQuery, setEditRpSearchQuery] = useState('');
  const [editMode, setEditMode] = useState('Lecture Cum Discussion');
  const [editStaffIds, setEditStaffIds] = useState<string[]>([]);
  const [editStaffSearchQuery, setEditStaffSearchQuery] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);

  // Delete Confirm Modal State
  const [deletingRecord, setDeletingRecord] = useState<CNERecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

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

  // Sort by date (newest first)
  const sortedRecords = useMemo(() => {
    return [...records].sort((a, b) => (b.fromDate || '').localeCompare(a.fromDate || ''));
  }, [records]);

  // Filtered list based on sorted records
  const filteredRecords = useMemo(() => {
    return sortedRecords.filter((rec) => {
      if (selectedArea && rec.area !== selectedArea) return false;
      if (startDate && rec.fromDate < startDate) return false;
      if (endDate && rec.fromDate > endDate) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTopic = (rec.topic || '').toLowerCase().includes(q);
        const matchArea = (rec.area || '').toLowerCase().includes(q);
        const matchRp = (rec.resourcePersonName || rec.resourcePersonEmpId || '').toLowerCase().includes(q);
        const matchRemarks = (rec.remarks || '').toLowerCase().includes(q);
        const matchStaff = (rec.staffEmpIds || []).some((s) => s.toLowerCase().includes(q));

        if (!matchTopic && !matchArea && !matchRp && !matchRemarks && !matchStaff) {
          return false;
        }
      }

      return true;
    });
  }, [sortedRecords, selectedArea, startDate, endDate, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  // Handle Add CNE Activity
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTopic.trim() || !formArea.trim() || !formFromDate.trim() || selectedRpEmpIds.length === 0) {
      error('Please complete all required fields (Topic, Area, Date, at least one Resource Person).');
      return;
    }

    if (formToDate && formToDate < formFromDate) {
      error('To Date cannot be earlier than From Date.');
      return;
    }

    // Build resource person names
    const rpNames = selectedRpEmpIds.map((id) => {
      const off = officers.find((o) => o.employeeId === id);
      return off ? off.name : id;
    });

    setIsSubmitting(true);
    try {
      const res = await ApiService.addCNE({
        area: formArea,
        fromDate: formFromDate,
        toDate: formToDate || formFromDate,
        duration: formDuration || '1:00:00',
        topic: formTopic.trim(),
        resourcePersonEmpId: selectedRpEmpIds.join(', '),
        resourcePersonName: rpNames.join(', '),
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
        setSelectedRpEmpIds([]);
        setSelectedStaffIds([]);
        setFormRemarks('');
        setRpSearchQuery('');
        setStaffSearchQuery('');
      } else {
        error(res.message || 'Failed to save CNE record.');
      }
    } catch (err: any) {
      error(err?.message || 'Error saving record.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (rec: CNERecord) => {
    setEditingRecord(rec);
    setEditArea(rec.area || '');
    setEditFromDate(rec.fromDate || '');
    setEditToDate(rec.toDate || rec.fromDate || '');
    setEditDuration(rec.duration || '1:00:00');
    setEditTopic(rec.topic || '');
    setEditMode(rec.modeOfTeaching || 'Lecture Cum Discussion');
    setEditRemarks(rec.remarks || '');

    // Parse RP IDs
    const parsedRp = (rec.resourcePersonEmpId || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    setEditRpEmpIds(parsedRp);

    // Staff IDs
    setEditStaffIds(rec.staffEmpIds ? [...rec.staffEmpIds] : []);
    setEditRpSearchQuery('');
    setEditStaffSearchQuery('');
  };

  // Save Edit Modal
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord) return;

    if (!editTopic.trim() || !editArea.trim() || !editFromDate.trim() || editRpEmpIds.length === 0) {
      error('Please complete all required fields (Topic, Area, Date, at least one Resource Person).');
      return;
    }

    if (editToDate && editToDate < editFromDate) {
      error('To Date cannot be earlier than From Date.');
      return;
    }

    const rpNames = editRpEmpIds.map((id) => {
      const off = officers.find((o) => o.employeeId === id);
      return off ? off.name : id;
    });

    const updatedData: Partial<CNERecord> = {
      area: editArea,
      fromDate: editFromDate,
      toDate: editToDate || editFromDate,
      duration: editDuration || '1:00:00',
      topic: editTopic.trim(),
      resourcePersonEmpId: editRpEmpIds.join(', '),
      resourcePersonName: rpNames.join(', '),
      modeOfTeaching: editMode,
      staffEmpIds: editStaffIds,
      staffCount: editStaffIds.length,
      remarks: editRemarks.trim()
    };

    setIsEditSubmitting(true);
    try {
      const res = await ApiService.updateCNE(editingRecord.dataId, updatedData);
      if (res.success) {
        success('CNE record updated successfully.', 'Record Updated');
        setRecords((prev) =>
          prev.map((r) => (r.dataId === editingRecord.dataId ? ({ ...r, ...updatedData } as CNERecord) : r))
        );
        setEditingRecord(null);
      } else {
        error(res.message || 'Failed to update record.');
      }
    } catch (err: any) {
      error(err?.message || 'Error updating record.');
    } finally {
      setIsEditSubmitting(false);
    }
  };

  // Delete action
  const confirmDelete = async () => {
    if (!deletingRecord || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await ApiService.deleteCNE(deletingRecord.dataId);
      if (res.success) {
        success('CNE activity deleted successfully.', 'Record Deleted');
        setRecords((prev) => prev.filter((r) => r.dataId !== deletingRecord.dataId));
        setDeletingRecord(null);
      } else {
        error(res.message || 'Failed to delete record.');
      }
    } catch (err: any) {
      error(err?.message || 'Error deleting record.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (records.length === 0) return;
    const headers = ['Sr. No.', 'Ward Name / Area', 'From Date', 'To Date', 'Duration', 'Topic', 'Resource Person Emp Id', 'Mode of Teaching', 'Staff Emp ID', 'Staff Count', 'Remarks'];
    const rows = sortedRecords.map((r, i) => [
      `"${i + 1}"`,
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

  // Filter officers for RP multi-select (Add modal)
  const filteredRpOptions = officers.filter((o) => {
    if (!rpSearchQuery.trim()) return true;
    const q = rpSearchQuery.toLowerCase();
    return (
      (o.name || '').toLowerCase().includes(q) ||
      (o.employeeId || '').toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q)
    );
  });

  const toggleRpSelection = (empId: string) => {
    setSelectedRpEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // Filter officers for Staff multi-select (Add modal)
  const filteredStaffOptions = officers.filter((o) => {
    if (!staffSearchQuery.trim()) return true;
    const q = staffSearchQuery.toLowerCase();
    return (
      (o.name || '').toLowerCase().includes(q) ||
      (o.employeeId || '').toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q)
    );
  });

  const toggleStaffSelection = (empId: string) => {
    setSelectedStaffIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // Filter officers for RP multi-select (Edit modal)
  const filteredEditRpOptions = officers.filter((o) => {
    if (!editRpSearchQuery.trim()) return true;
    const q = editRpSearchQuery.toLowerCase();
    return (
      (o.name || '').toLowerCase().includes(q) ||
      (o.employeeId || '').toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q)
    );
  });

  const toggleEditRpSelection = (empId: string) => {
    setEditRpEmpIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // Filter officers for Staff multi-select (Edit modal)
  const filteredEditStaffOptions = officers.filter((o) => {
    if (!editStaffSearchQuery.trim()) return true;
    const q = editStaffSearchQuery.toLowerCase();
    return (
      (o.name || '').toLowerCase().includes(q) ||
      (o.employeeId || '').toLowerCase().includes(q) ||
      (o.designation || '').toLowerCase().includes(q)
    );
  });

  const toggleEditStaffSelection = (empId: string) => {
    setEditStaffIds((prev) =>
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
            Institutional repository of Continuing Nursing Education sessions, training hours, and staff participant attendance (Sorted newest first).
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadAllData}
            disabled={loading}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh from Google Sheets"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          <button
            id="btn-admin-export-csv"
            onClick={handleExportCsv}
            disabled={records.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-semibold transition-colors cursor-pointer disabled:opacity-50"
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
          {/* Search (Data ID hidden from placeholder) */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search topic, area, instructor, staff ID..."
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
            Showing {filteredRecords.length} of {records.length} records (Sorted newest first)
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
              className="text-xs text-rose-600 hover:underline cursor-pointer font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Table (Data ID is completely hidden from UI) */}
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
                    <th className="py-3 px-3 text-center w-12">#</th>
                    <th className="py-3 px-3 w-24">Date</th>
                    <th className="py-3 px-3 w-40">Ward / Area</th>
                    <th className="py-3 px-3 min-w-[200px]">Topic / Subject</th>
                    <th className="py-3 px-3 min-w-[150px]">Resource Person(s)</th>
                    <th className="py-3 px-3">Mode</th>
                    <th className="py-3 px-3 text-center w-24">Participants</th>
                    <th className="py-3 px-3 text-center w-24">Duration</th>
                    <th className="py-3 px-3 text-right w-24">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.map((rec, idx) => {
                    const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                    return (
                      <tr key={rec.dataId} className="hover:bg-slate-50">
                        {/* Sr. No. (Replacing Data ID) */}
                        <td className="py-3 px-3 text-center font-medium text-slate-400">
                          {rowNumber}
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-800 font-medium">
                          {rec.fromDate}
                        </td>

                        {/* Area */}
                        <td className="py-3 px-3 text-slate-700">
                          <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 truncate inline-block max-w-[160px]">
                            {rec.area}
                          </span>
                        </td>

                        {/* Topic */}
                        <td className="py-3 px-3 font-semibold text-slate-900">
                          {rec.topic}
                        </td>

                        {/* Resource Person(s) */}
                        <td className="py-3 px-3 text-slate-700">
                          <span className="line-clamp-2">
                            {rec.resourcePersonName || rec.resourcePersonEmpId || '—'}
                          </span>
                        </td>

                        {/* Mode */}
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {rec.modeOfTeaching}
                        </td>

                        {/* Staff Count */}
                        <td className="py-3 px-3 text-center">
                          <span className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full text-[11px]">
                            {rec.staffCount || (rec.staffEmpIds ? rec.staffEmpIds.length : 0)}
                          </span>
                        </td>

                        {/* Duration (Preserved) */}
                        <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-slate-600">
                          {rec.duration || '1:00:00'}
                        </td>

                        {/* Actions (Modal triggers) */}
                        <td className="py-3 px-3 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => openEditModal(rec)}
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                              title="Edit CNE Record (Modal)"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeletingRecord(rec)}
                              className="p-1.5 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                              title="Delete record"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
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
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================= */}
      {/* 1. ADD CNE Activity Modal (With RP & Staff Multi-Select)  */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              disabled={isSubmitting}
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

              {/* Dates & Duration (Preserved Duration Handling) */}
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

              {/* MULTI-SELECT 1: Resource Persons */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Resource Person(s) / Instructors (Multi-Select) *
                  </label>
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                    Selected: {selectedRpEmpIds.length}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter resource persons by name or ID..."
                    value={rpSearchQuery}
                    onChange={(e) => setRpSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* Selected RP chips */}
                {selectedRpEmpIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                    {selectedRpEmpIds.map((id) => {
                      const off = officers.find((o) => o.employeeId === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-purple-50 text-purple-900 px-2 py-0.5 rounded-md border border-purple-200"
                        >
                          <span>{id} — {off ? off.name : ''}</span>
                          <button
                            type="button"
                            onClick={() => toggleRpSelection(id)}
                            className="hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* RP Selection List */}
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                  {filteredRpOptions.slice(0, 15).map((o) => {
                    const isSelected = selectedRpEmpIds.includes(o.employeeId);
                    return (
                      <div
                        key={o.employeeId}
                        onClick={() => toggleRpSelection(o.employeeId)}
                        className={`p-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer text-xs ${
                          isSelected ? 'bg-purple-50/60 font-semibold' : ''
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
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* MULTI-SELECT 2: Staff Participants */}
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
                          className="rounded text-emerald-600 focus:ring-emerald-500"
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
                  disabled={isSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Saving Activity...</span>
                    </>
                  ) : (
                    <span>Save CNE Activity</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. EDIT CNE Activity Modal (Replacing Inline Edit)        */}
      {/* ========================================================= */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setEditingRecord(null)}
              disabled={isEditSubmitting}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center">
                <Edit2 className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Edit CNE Activity Record</h3>
                <p className="text-xs text-slate-500">Update session details, resource persons, and participants</p>
              </div>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4 text-xs">
              {/* Topic */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                  CNE Topic / Skills Description *
                </label>
                <input
                  type="text"
                  required
                  value={editTopic}
                  onChange={(e) => setEditTopic(e.target.value)}
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
                    value={editArea}
                    onChange={(e) => setEditArea(e.target.value)}
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
                    value={editMode}
                    onChange={(e) => setEditMode(e.target.value)}
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
                    value={editFromDate}
                    onChange={(e) => setEditFromDate(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                    To Date
                  </label>
                  <input
                    type="date"
                    value={editToDate}
                    onChange={(e) => setEditToDate(e.target.value)}
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
                    value={editDuration}
                    onChange={(e) => setEditDuration(e.target.value)}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                  />
                </div>
              </div>

              {/* EDIT MULTI-SELECT 1: Resource Persons */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Resource Person(s) / Instructors (Multi-Select) *
                  </label>
                  <span className="text-xs font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-full">
                    Selected: {editRpEmpIds.length}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter resource persons by name or ID..."
                    value={editRpSearchQuery}
                    onChange={(e) => setEditRpSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* Selected RP chips */}
                {editRpEmpIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                    {editRpEmpIds.map((id) => {
                      const off = officers.find((o) => o.employeeId === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-purple-50 text-purple-900 px-2 py-0.5 rounded-md border border-purple-200"
                        >
                          <span>{id} — {off ? off.name : ''}</span>
                          <button
                            type="button"
                            onClick={() => toggleEditRpSelection(id)}
                            className="hover:text-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}

                {/* RP Selection List */}
                <div className="max-h-32 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white">
                  {filteredEditRpOptions.slice(0, 15).map((o) => {
                    const isSelected = editRpEmpIds.includes(o.employeeId);
                    return (
                      <div
                        key={o.employeeId}
                        onClick={() => toggleEditRpSelection(o.employeeId)}
                        className={`p-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer text-xs ${
                          isSelected ? 'bg-purple-50/60 font-semibold' : ''
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
                          className="rounded text-purple-600 focus:ring-purple-500"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* EDIT MULTI-SELECT 2: Staff Participants */}
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Staff Participants (Multi-Select)
                  </label>
                  <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                    Selected Count: {editStaffIds.length}
                  </span>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                  <input
                    type="text"
                    placeholder="Filter staff by name or employee ID..."
                    value={editStaffSearchQuery}
                    onChange={(e) => setEditStaffSearchQuery(e.target.value)}
                    className="w-full pl-8 pr-2 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>

                {/* Selected staff chips */}
                {editStaffIds.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1 bg-white rounded-lg border border-slate-200">
                    {editStaffIds.map((id) => {
                      const off = officers.find((o) => o.employeeId === id);
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 text-[11px] font-medium bg-slate-100 text-slate-800 px-2 py-0.5 rounded-md border border-slate-300"
                        >
                          <span>{id} — {off ? off.name : ''}</span>
                          <button
                            type="button"
                            onClick={() => toggleEditStaffSelection(id)}
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
                  {filteredEditStaffOptions.slice(0, 15).map((o) => {
                    const isSelected = editStaffIds.includes(o.employeeId);
                    return (
                      <div
                        key={o.employeeId}
                        onClick={() => toggleEditStaffSelection(o.employeeId)}
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
                          className="rounded text-emerald-600 focus:ring-emerald-500"
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
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  placeholder="Additional skills notes, simulation equipment used..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded-lg text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  disabled={isEditSubmitting}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 disabled:opacity-50 cursor-pointer"
                >
                  {isEditSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Update CNE Record</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. Delete Confirmation Modal (Data ID hidden from text)    */}
      {/* ========================================================= */}
      {deletingRecord && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-xl border border-slate-200 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Delete CNE Activity?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete the CNE activity on <strong className="text-slate-800">"{deletingRecord.topic}"</strong> held on <strong className="text-slate-800">{deletingRecord.fromDate}</strong>? This will remove participation records from connected staff portfolios.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeletingRecord(null)}
                disabled={isDeleting}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg cursor-pointer disabled:opacity-50"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Deleting...</span>
                  </>
                ) : (
                  <span>Yes, Delete Record</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

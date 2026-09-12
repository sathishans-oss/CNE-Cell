import React, { useState, useEffect, useMemo, useRef } from 'react';
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
  UserCheck,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { Area, CNERecord, Employee, SessionUser, SheetAuditItem } from '../types';
import { ApiService } from '../services/api';
import { useToast } from './Toast';
import {
  formatCneDateDisplay,
  formatCneDateRangeDisplay,
  formatResourcePersonsDisplay,
  formatStaffParticipantsDisplay,
  resolveEmployeeName,
  validateCneDuration
} from '../utils';
import { CneDateTimeFields } from './cne/CneDateTimeFields';
import { loadOfficersSingleFlight, getCachedOfficers } from '../services/officerLoader';

function parseDateTimeParts(dateTimeStr?: string, defaultTime: string = '09:00') {
  if (!dateTimeStr) return { date: '', time: defaultTime };
  if (dateTimeStr.includes('T')) {
    const [d, t] = dateTimeStr.split('T');
    return { date: d, time: t.substring(0, 5) || defaultTime };
  }
  return { date: dateTimeStr, time: defaultTime };
}

interface AdminCNEDataProps {
  user: SessionUser;
  isOpenAddModalDefault?: boolean;
}

export const AdminCNEData: React.FC<AdminCNEDataProps> = ({
  user,
  isOpenAddModalDefault = false
}) => {
  const [records, setRecords] = useState<CNERecord[]>(() => ApiService.getCachedData<CNERecord[]>('getCNERecords') || []);
  const [areas, setAreas] = useState<Area[]>(() => ApiService.getCachedData<Area[]>('getAreas') || []);
  const [officers, setOfficers] = useState<Employee[]>(() => getCachedOfficers() || []);
  const [loading, setLoading] = useState(() => (ApiService.getCachedData<CNERecord[]>('getCNERecords') ? false : true));

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedArea, setSelectedArea] = useState('');
  const [selectedCneType, setSelectedCneType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Add CNE Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(isOpenAddModalDefault);
  const [formCneType, setFormCneType] = useState<'CENTRAL' | 'DEPARTMENTAL'>('CENTRAL');
  const [formArea, setFormArea] = useState('');
  const [formFromDate, setFormFromDate] = useState('');
  const [formFromTime, setFormFromTime] = useState('09:00');
  const [formToDate, setFormToDate] = useState('');
  const [formToTime, setFormToTime] = useState('10:30');
  const [formDuration, setFormDuration] = useState('00:00:00');
  const [formTopic, setFormTopic] = useState('');
  const [selectedRpEmpIds, setSelectedRpEmpIds] = useState<string[]>([]);
  const [rpSearchQuery, setRpSearchQuery] = useState('');
  const [externalRpList, setExternalRpList] = useState<string[]>([]);
  const [externalRpInput, setExternalRpInput] = useState('');
  const [formMode, setFormMode] = useState('Lecture Cum Discussion');
  const [selectedStaffIds, setSelectedStaffIds] = useState<string[]>([]);
  const [staffSearchQuery, setStaffSearchQuery] = useState('');
  const [externalStaffList, setExternalStaffList] = useState<string[]>([]);
  const [externalStaffInput, setExternalStaffInput] = useState('');
  const [formRemarks, setFormRemarks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);

  // Edit CNE Modal State (Replacing Inline Edit)
  const [editingRecord, setEditingRecord] = useState<CNERecord | null>(null);
  const [editCneType, setEditCneType] = useState<'CENTRAL' | 'DEPARTMENTAL'>('CENTRAL');
  const [editArea, setEditArea] = useState('');
  const [editFromDate, setEditFromDate] = useState('');
  const [editFromTime, setEditFromTime] = useState('09:00');
  const [editToDate, setEditToDate] = useState('');
  const [editToTime, setEditToTime] = useState('10:30');
  const [editDuration, setEditDuration] = useState('00:00:00');
  const [editTopic, setEditTopic] = useState('');
  const [editRpEmpIds, setEditRpEmpIds] = useState<string[]>([]);
  const [editRpSearchQuery, setEditRpSearchQuery] = useState('');
  const [editExternalRpList, setEditExternalRpList] = useState<string[]>([]);
  const [editExternalRpInput, setEditExternalRpInput] = useState('');
  const [editMode, setEditMode] = useState('Lecture Cum Discussion');
  const [editStaffIds, setEditStaffIds] = useState<string[]>([]);
  const [editStaffSearchQuery, setEditStaffSearchQuery] = useState('');
  const [editExternalStaffList, setEditExternalStaffList] = useState<string[]>([]);
  const [editExternalStaffInput, setEditExternalStaffInput] = useState('');
  const [editRemarks, setEditRemarks] = useState('');
  const [isEditSubmitting, setIsEditSubmitting] = useState(false);
  const editSubmittingRef = useRef(false);

  // Delete Confirm Modal State
  const [deletingRecord, setDeletingRecord] = useState<CNERecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const deletingRef = useRef(false);

  // Verify Sheets State (Admin Only)
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const verifyingRef = useRef(false);
  const [verifyReport, setVerifyReport] = useState<SheetAuditItem[] | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const { success, error } = useToast();

  const handleExecuteVerifySheets = async () => {
    if (user.role !== 'ADMIN') return;
    if (verifyingRef.current || isVerifying) return;

    verifyingRef.current = true;
    setIsVerifying(true);
    setVerifyError(null);
    setVerifyReport(null);

    try {
      const res = await ApiService.setupAndVerifyCNESheets();
      if (res.success) {
        const report: SheetAuditItem[] =
          (res as any).auditReport ||
          (res.data as any)?.auditReport ||
          [];
        setVerifyReport(report);
        success('CNE Sheets verification completed successfully.');
      } else {
        const errMsg = res.message || 'Failed to verify CNE Sheets.';
        setVerifyError(errMsg);
        error(errMsg);
      }
    } catch (e: any) {
      const errMsg = e?.message || 'Unexpected network error during verification.';
      setVerifyError(errMsg);
      error(errMsg);
    } finally {
      verifyingRef.current = false;
      setIsVerifying(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    if (records.length === 0) {
      setLoading(true);
    }
    try {
      const [recordsRes, areasRes, officersList] = await Promise.all([
        ApiService.getCNERecords(),
        ApiService.getAreas(),
        loadOfficersSingleFlight()
      ]);

      if (recordsRes.success && recordsRes.data) setRecords(recordsRes.data);
      if (areasRes.success && areasRes.data) setAreas(areasRes.data);
      if (officersList && officersList.length > 0) setOfficers(officersList);
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
      if (selectedCneType && (rec.cneType || 'CENTRAL').toUpperCase() !== selectedCneType.toUpperCase()) return false;
      if (startDate && rec.fromDate < startDate) return false;
      if (endDate && rec.fromDate > endDate) return false;

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matchTopic = (rec.topic || '').toLowerCase().includes(q);
        const matchArea = (rec.area || '').toLowerCase().includes(q);
        const rpDisplay = formatResourcePersonsDisplay({
          resourcePersonEmpId: rec.resourcePersonEmpId,
          resourcePersonName: rec.resourcePersonName,
          externalResourcePersons: rec.externalResourcePersons,
          officers
        }).toLowerCase();
        const matchRp = rpDisplay.includes(q) || (rec.resourcePersonEmpId || '').toLowerCase().includes(q);
        const matchRemarks = (rec.remarks || '').toLowerCase().includes(q);
        const matchStaff = (rec.staffEmpIds || []).some((s) => {
          const staffName = resolveEmployeeName(s, officers).toLowerCase();
          return s.toLowerCase().includes(q) || staffName.includes(q);
        });

        if (!matchTopic && !matchArea && !matchRp && !matchRemarks && !matchStaff) {
          return false;
        }
      }

      return true;
    });
  }, [sortedRecords, selectedArea, selectedCneType, startDate, endDate, searchTerm]);

  // Pagination
  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage) || 1;
  const paginatedRecords = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(start, start + itemsPerPage);
  }, [filteredRecords, currentPage]);

  // Helpers for external personnel (Add Modal)
  const handleAddExternalRp = () => {
    const val = externalRpInput.trim();
    if (!val) return;
    if (!externalRpList.includes(val)) {
      setExternalRpList((prev) => [...prev, val]);
    }
    setExternalRpInput('');
  };

  const handleRemoveExternalRp = (idx: number) => {
    setExternalRpList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddExternalStaff = () => {
    const val = externalStaffInput.trim();
    if (!val) return;
    if (!externalStaffList.includes(val)) {
      setExternalStaffList((prev) => [...prev, val]);
    }
    setExternalStaffInput('');
  };

  const handleRemoveExternalStaff = (idx: number) => {
    setExternalStaffList((prev) => prev.filter((_, i) => i !== idx));
  };

  // Helpers for external personnel (Edit Modal)
  const handleAddEditExternalRp = () => {
    const val = editExternalRpInput.trim();
    if (!val) return;
    if (!editExternalRpList.includes(val)) {
      setEditExternalRpList((prev) => [...prev, val]);
    }
    setEditExternalRpInput('');
  };

  const handleRemoveEditExternalRp = (idx: number) => {
    setEditExternalRpList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleAddEditExternalStaff = () => {
    const val = editExternalStaffInput.trim();
    if (!val) return;
    if (!editExternalStaffList.includes(val)) {
      setEditExternalStaffList((prev) => [...prev, val]);
    }
    setEditExternalStaffInput('');
  };

  const handleRemoveEditExternalStaff = (idx: number) => {
    setEditExternalStaffList((prev) => prev.filter((_, i) => i !== idx));
  };

  // Handle Add CNE
  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submittingRef.current || isSubmitting) return;

    if (!formTopic.trim() || !formArea.trim() || !formFromDate.trim() || (selectedRpEmpIds.length === 0 && externalRpList.length === 0)) {
      error('Please complete all required fields (Topic, Area, Date & Time, at least one Resource Person).');
      return;
    }

    const fullFrom = formFromDate && formFromTime ? `${formFromDate}T${formFromTime}` : formFromDate;
    const fullTo = formToDate && formToTime ? `${formToDate}T${formToTime}` : (formToDate || fullFrom);

    if (formToDate && formFromDate && formToDate < formFromDate) {
      error('To Date cannot be earlier than From Date.');
      return;
    }

    if (fullTo && fullFrom && fullTo < fullFrom) {
      error('To Date & Time must be equal to or later than From Date & Time.');
      return;
    }

    if (formDuration && formDuration !== '00:00:00') {
      const durVal = validateCneDuration(formDuration, fullFrom, fullTo);
      if (!durVal.isValid) {
        error(durVal.message);
        return;
      }
    }

    // Build resource person names
    const rpNames = selectedRpEmpIds.map((id) => {
      const off = officers.find((o) => o.employeeId === id);
      return off ? off.name : id;
    });
    if (externalRpList.length > 0) {
      rpNames.push(...externalRpList.map((n) => `${n} (External)`));
    }

    const totalStaffCount = selectedStaffIds.length + externalStaffList.length;

    submittingRef.current = true;
    setIsSubmitting(true);
    try {
      const res = await ApiService.addCNE({
        cneType: formCneType,
        area: formArea,
        fromDate: fullFrom,
        toDate: fullTo || fullFrom,
        duration: formDuration || '00:00:00',
        topic: formTopic.trim(),
        resourcePersonEmpId: selectedRpEmpIds.join(', '),
        resourcePersonEmpIds: selectedRpEmpIds,
        resourcePersonName: rpNames.join(', '),
        externalResourcePersons: externalRpList,
        modeOfTeaching: formMode,
        staffEmpIds: selectedStaffIds,
        externalStaffParticipants: externalStaffList,
        staffCount: totalStaffCount,
        remarks: formRemarks.trim()
      } as any);

      if (res.success && res.data) {
        success('CNE recorded and saved successfully.', 'CNE Added');
        setRecords((prev) => [res.data!, ...prev]);
        setIsAddModalOpen(false);
        // Reset form
        setFormTopic('');
        setFormFromDate('');
        setFormFromTime('09:00');
        setFormToDate('');
        setFormToTime('10:30');
        setFormDuration('00:00:00');
        setSelectedRpEmpIds([]);
        setSelectedStaffIds([]);
        setExternalRpList([]);
        setExternalRpInput('');
        setExternalStaffList([]);
        setExternalStaffInput('');
        setFormRemarks('');
        setRpSearchQuery('');
        setStaffSearchQuery('');
      } else {
        error(res.message || 'Failed to save CNE record.');
      }
    } catch (err: any) {
      error(err?.message || 'Error saving record.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Open Edit Modal
  const openEditModal = (rec: CNERecord) => {
    setEditingRecord(rec);
    setEditCneType((rec.cneType as any) || 'CENTRAL');
    setEditArea(rec.area || '');
    const fromParts = parseDateTimeParts(rec.fromDate, '09:00');
    const toParts = parseDateTimeParts(rec.toDate || rec.fromDate, '10:30');
    setEditFromDate(fromParts.date);
    setEditFromTime(fromParts.time);
    setEditToDate(toParts.date);
    setEditToTime(toParts.time);
    setEditDuration(rec.duration || '00:00:00');
    setEditTopic(rec.topic || '');
    setEditMode(rec.modeOfTeaching || 'Lecture Cum Discussion');
    setEditRemarks(rec.remarks || '');

    // Parse RP IDs
    const parsedRp = (rec.resourcePersonEmpId || '')
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s && !s.toLowerCase().startsWith('ext:'));
    setEditRpEmpIds(parsedRp);

    // External RPs
    setEditExternalRpList(rec.externalResourcePersons ? [...rec.externalResourcePersons] : []);
    setEditExternalRpInput('');

    // Staff IDs
    setEditStaffIds(rec.staffEmpIds ? [...rec.staffEmpIds] : []);
    setEditExternalStaffList(rec.externalStaffParticipants ? [...rec.externalStaffParticipants] : []);
    setEditExternalStaffInput('');

    setEditRpSearchQuery('');
    setEditStaffSearchQuery('');
  };

  // Save Edit Modal
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingRecord || editSubmittingRef.current || isEditSubmitting) return;

    if (!editTopic.trim() || !editArea.trim() || !editFromDate.trim() || (editRpEmpIds.length === 0 && editExternalRpList.length === 0)) {
      error('Please complete all required fields (Topic, Area, Date & Time, at least one Resource Person).');
      return;
    }

    const fullFrom = editFromDate && editFromTime ? `${editFromDate}T${editFromTime}` : editFromDate;
    const fullTo = editToDate && editToTime ? `${editToDate}T${editToTime}` : (editToDate || fullFrom);

    if (editToDate && editFromDate && editToDate < editFromDate) {
      error('To Date cannot be earlier than From Date.');
      return;
    }

    if (fullTo && fullFrom && fullTo < fullFrom) {
      error('To Date & Time must be equal to or later than From Date & Time.');
      return;
    }

    if (editDuration && editDuration !== '00:00:00') {
      const durVal = validateCneDuration(editDuration, fullFrom, fullTo);
      if (!durVal.isValid) {
        error(durVal.message);
        return;
      }
    }

    const rpNames = editRpEmpIds.map((id) => {
      const off = officers.find((o) => o.employeeId === id);
      return off ? off.name : id;
    });
    if (editExternalRpList.length > 0) {
      rpNames.push(...editExternalRpList.map((n) => `${n} (External)`));
    }

    const totalStaffCount = editStaffIds.length + editExternalStaffList.length;

    const updatedData: any = {
      cneType: editCneType,
      area: editArea,
      fromDate: fullFrom,
      toDate: fullTo || fullFrom,
      duration: editDuration || '00:00:00',
      topic: editTopic.trim(),
      resourcePersonEmpId: editRpEmpIds.join(', '),
      resourcePersonEmpIds: editRpEmpIds,
      resourcePersonName: rpNames.join(', '),
      externalResourcePersons: editExternalRpList,
      modeOfTeaching: editMode,
      staffEmpIds: editStaffIds,
      externalStaffParticipants: editExternalStaffList,
      staffCount: totalStaffCount,
      remarks: editRemarks.trim()
    };

    editSubmittingRef.current = true;
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
      editSubmittingRef.current = false;
      setIsEditSubmitting(false);
    }
  };

  // Delete action
  const confirmDelete = async () => {
    if (!deletingRecord || deletingRef.current || isDeleting) return;
    deletingRef.current = true;
    setIsDeleting(true);
    try {
      const res = await ApiService.deleteCNE(deletingRecord.dataId);
      if (res.success) {
        success('CNE record deleted successfully.', 'Record Deleted');
        setRecords((prev) => prev.filter((r) => r.dataId !== deletingRecord.dataId));
        setDeletingRecord(null);
        setEditingRecord(null);
      } else {
        error(res.message || 'Failed to delete record.');
      }
    } catch (err: any) {
      error(err?.message || 'Error deleting record.');
    } finally {
      deletingRef.current = false;
      setIsDeleting(false);
    }
  };

  // Export CSV
  const handleExportCsv = () => {
    if (records.length === 0) return;
    const headers = ['Sr. No.', 'Type of CNE', 'Ward Name / Area', 'From Date', 'To Date', 'Duration', 'Topic', 'Resource Person Emp Id / External', 'Mode of Teaching', 'Staff Emp ID / External', 'Staff Count', 'Remarks'];
    const rows = sortedRecords.map((r, i) => {
      const rpParts = [r.resourcePersonEmpId];
      if (r.externalResourcePersons && r.externalResourcePersons.length > 0) {
        rpParts.push(r.externalResourcePersons.map((p) => `Ext: ${p}`).join(', '));
      }
      const rpDisplay = rpParts.filter(Boolean).join('; ');

      const staffParts = [...(r.staffEmpIds || [])];
      if (r.externalStaffParticipants && r.externalStaffParticipants.length > 0) {
        staffParts.push(...r.externalStaffParticipants.map((p) => `Ext: ${p}`));
      }
      const staffDisplay = staffParts.join(', ');

      return [
        `"${i + 1}"`,
        `"${r.cneType || 'CENTRAL'}"`,
        `"${r.area}"`,
        `"${r.fromDate}"`,
        `"${r.toDate || ''}"`,
        `"${r.duration}"`,
        `"${(r.topic || '').replace(/"/g, '""')}"`,
        `"${rpDisplay.replace(/"/g, '""')}"`,
        `"${r.modeOfTeaching}"`,
        `"${staffDisplay.replace(/"/g, '""')}"`,
        `"${r.staffCount}"`,
        `"${(r.remarks || '').replace(/"/g, '""')}"`
      ];
    });

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

        <div className="flex items-center gap-2 flex-wrap">
          {/* Admin-only Sheet Verification / Initialization Action */}
          {user.role === 'ADMIN' && (
            <button
              id="btn-admin-verify-sheets"
              type="button"
              onClick={() => {
                setVerifyReport(null);
                setVerifyError(null);
                setIsVerifyModalOpen(true);
              }}
              disabled={isVerifying || loading}
              className="flex items-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold transition-colors cursor-pointer disabled:opacity-50"
              title="Verify or create missing CNE tabs and headers in CNE Sheets"
            >
              {isVerifying ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Verify / Initialize CNE Sheets</span>
                </>
              )}
            </button>
          )}

          <button
            onClick={loadAllData}
            disabled={loading || isVerifying}
            className="p-2.5 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer disabled:opacity-50"
            title="Refresh data"
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
            onClick={() => {
              setFormFromDate('');
              setFormFromTime('09:00');
              setFormToDate('');
              setFormToTime('10:30');
              setFormDuration('00:00:00');
              setIsAddModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
          >
            <PlusCircle className="w-4 h-4 text-emerald-400" />
            <span>Record Unscheduled CNE</span>
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
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

          {/* CNE Type Filter */}
          <div>
            <select
              value={selectedCneType}
              onChange={(e) => {
                setSelectedCneType(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-300 rounded-lg text-slate-700 font-medium"
            >
              <option value="">All CNE Types</option>
              <option value="CENTRAL">Central CNE</option>
              <option value="DEPARTMENTAL">Departmental CNE</option>
            </select>
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
          {(searchTerm || selectedArea || selectedCneType || startDate || endDate) && (
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedArea('');
                setSelectedCneType('');
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
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
            <span className="text-xs font-medium">Loading data</span>
          </div>
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
                    <th className="py-3 px-3 w-28">Type</th>
                    <th className="py-3 px-3 w-24">Date</th>
                    <th className="py-3 px-3 w-36">Ward / Area</th>
                    <th className="py-3 px-3 min-w-[200px]">Topic / Subject</th>
                    <th className="py-3 px-3 min-w-[150px]">Resource Person(s)</th>
                    <th className="py-3 px-3">Mode</th>
                    <th className="py-3 px-3 text-center w-24">Participants</th>
                    <th className="py-3 px-3 text-center w-24">Duration</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginatedRecords.map((rec, idx) => {
                    const rowNumber = (currentPage - 1) * itemsPerPage + idx + 1;
                    const isCentral = (rec.cneType || 'CENTRAL').toUpperCase() === 'CENTRAL';
                    return (
                      <tr
                        key={rec.dataId}
                        onClick={() => openEditModal(rec)}
                        className="hover:bg-slate-100/80 cursor-pointer transition-colors"
                        title="Click to view or edit CNE record"
                      >
                        {/* Sr. No. (Replacing Data ID) */}
                        <td className="py-3 px-3 text-center font-medium text-slate-400">
                          {rowNumber}
                        </td>

                        {/* CNE Type */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              isCentral
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-teal-50 text-teal-700 border border-teal-200'
                            }`}
                          >
                            {rec.cneType || 'CENTRAL'}
                          </span>
                        </td>

                        {/* Date */}
                        <td className="py-3 px-3 whitespace-nowrap text-slate-800 font-medium">
                          {formatCneDateRangeDisplay(rec.fromDate, rec.toDate)}
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
                          <div className="line-clamp-2">
                            <span>
                              {formatResourcePersonsDisplay({
                                resourcePersonEmpId: rec.resourcePersonEmpId,
                                resourcePersonName: rec.resourcePersonName,
                                externalResourcePersons: rec.externalResourcePersons,
                                officers
                              })}
                            </span>
                          </div>
                        </td>

                        {/* Mode */}
                        <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                          {rec.modeOfTeaching}
                        </td>

                        {/* Staff Count with Names in Tooltip */}
                        <td className="py-3 px-3 text-center">
                          <span
                            className="font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded-full text-[11px] cursor-help"
                            title={`Participants (${rec.staffCount || 0}):\n${
                              formatStaffParticipantsDisplay({
                                staffEmpIds: rec.staffEmpIds,
                                staffNames: rec.staffNames,
                                externalStaffParticipants: rec.externalStaffParticipants,
                                officers
                              }).allNames.join(', ') || 'None'
                            }`}
                          >
                            {rec.staffCount || ((rec.staffEmpIds ? rec.staffEmpIds.length : 0) + (rec.externalStaffParticipants ? rec.externalStaffParticipants.length : 0))}
                          </span>
                        </td>

                        {/* Duration (Preserved) */}
                        <td className="py-3 px-3 text-center whitespace-nowrap font-mono text-slate-600">
                          {rec.duration || '1:00:00'}
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
      {/* 1. Record Unscheduled CNE Modal                          */}
      {/* ========================================================= */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <PlusCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Record Unscheduled CNE</h3>
                  <p className="text-xs text-slate-500">Records a CNE session conducted outside the web scheduling workflow.</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                disabled={isSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* 4 Logical Sections organized into a responsive grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                  {/* Section 1: Classification & CNE Details */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 border-b border-purple-100 pb-2 flex items-center gap-1.5">
                      <span>1. Classification &amp; CNE Details</span>
                    </h4>

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
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    {/* Type of CNE */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Type of CNE *
                      </label>
                      <select
                        required
                        value={formCneType}
                        onChange={(e) => setFormCneType(e.target.value as any)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        <option value="CENTRAL">Central CNE</option>
                        <option value="DEPARTMENTAL">Departmental CNE</option>
                      </select>
                    </div>

                    {/* Ward Name / Area */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Ward Name / Area *
                      </label>
                      <select
                        required
                        value={formArea}
                        onChange={(e) => setFormArea(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        <option value="">Select Ward / Area...</option>
                        {activeAreas.map((a) => (
                          <option key={a.id} value={a.name}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Mode of Teaching */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Mode of Teaching
                      </label>
                      <select
                        value={formMode}
                        onChange={(e) => setFormMode(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        {teachingModes.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Remarks / Notes */}
                    <div className="flex-1 flex flex-col">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Remarks / Notes
                      </label>
                      <textarea
                        rows={3}
                        value={formRemarks}
                        onChange={(e) => setFormRemarks(e.target.value)}
                        placeholder="Additional skills notes, simulation equipment used..."
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none flex-1"
                      />
                    </div>
                  </div>

                  {/* Section 2: Date, Time & Duration */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-100 pb-2 flex items-center gap-1.5">
                      <span>2. Date, Time &amp; Duration</span>
                    </h4>

                    {/* Dates & Duration via CneDateTimeFields */}
                    <CneDateTimeFields
                      idPrefix="activity-add"
                      fromDate={formFromDate}
                      fromTime={formFromTime}
                      toDate={formToDate}
                      toTime={formToTime}
                      layout="stack"
                      accentColor="emerald"
                      onChange={({ fromDate, fromTime, toDate, toTime, calculatedDuration }) => {
                        setFormFromDate(fromDate);
                        setFormFromTime(fromTime);
                        setFormToDate(toDate);
                        setFormToTime(toTime);
                        if (calculatedDuration && calculatedDuration !== '00:00:00') {
                          setFormDuration(calculatedDuration);
                        }
                      }}
                    />

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Duration (HH:MM:SS) *
                        </label>
                        <span className="text-[10px] text-emerald-700 font-semibold">Auto-calculated</span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="00:00:00"
                        value={formDuration}
                        onChange={(e) => setFormDuration(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Calculated automatically from selected dates and times. Max 8 hrs/day. Format: HH:MM:SS
                      </p>
                    </div>
                  </div>

                  {/* Section 3: Resource Persons */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 border-b border-teal-100 pb-2 flex items-center justify-between">
                      <span>3. Resource Persons</span>
                      <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                        Selected: {selectedRpEmpIds.length}
                      </span>
                    </h4>

                    {/* Internal Resource Persons */}
                    <div className="space-y-2 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Resource Person(s) / Instructors *
                        </label>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Filter resource persons by name or ID..."
                          value={rpSearchQuery}
                          onChange={(e) => setRpSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
                                <span>{off ? off.name : id} <span className="text-[10px] text-purple-700 opacity-75 font-mono">({id})</span></span>
                                <button
                                  type="button"
                                  onClick={() => toggleRpSelection(id)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* RP Selection List */}
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white flex-1">
                        {filteredRpOptions.slice(0, 50).map((o) => {
                          const isSelected = selectedRpEmpIds.includes(o.employeeId);
                          return (
                            <div
                              key={o.employeeId}
                              onClick={() => toggleRpSelection(o.employeeId)}
                              className={`p-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer text-xs ${
                                isSelected ? 'bg-purple-50/60 font-semibold' : ''
                              }`}
                            >
                              <div className="truncate mr-2">
                                <span className="font-mono text-slate-600">{o.employeeId}</span>
                                <span className="mx-1.5">•</span>
                                <span className="text-slate-900">{o.name}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({o.designation})</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded text-purple-600 focus:ring-purple-500 pointer-events-none shrink-0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* External Resource Persons */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          External Resource Persons
                        </label>
                        <span className="text-[10px] text-slate-400">No Employee ID</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Prof. R. Sharma (PGI Chandigarh)..."
                          value={externalRpInput}
                          onChange={(e) => setExternalRpInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExternalRp();
                            }
                          }}
                          className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddExternalRp}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold rounded-lg text-xs cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                      {externalRpList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1 max-h-20 overflow-y-auto">
                          {externalRpList.map((rp, idx) => (
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
                  </div>

                  {/* Section 4: Participants */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-2 flex items-center justify-between">
                      <span>4. Participants</span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Selected: {selectedStaffIds.length}
                      </span>
                    </h4>

                    {/* Internal Participants */}
                    <div className="space-y-2 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Participants
                        </label>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Filter staff by name or employee ID..."
                          value={staffSearchQuery}
                          onChange={(e) => setStaffSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                                <span>{off ? off.name : id} <span className="text-[10px] text-slate-500 opacity-75 font-mono">({id})</span></span>
                                <button
                                  type="button"
                                  onClick={() => toggleStaffSelection(id)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Staff Selection List */}
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white flex-1">
                        {filteredStaffOptions.slice(0, 50).map((o) => {
                          const isSelected = selectedStaffIds.includes(o.employeeId);
                          return (
                            <div
                              key={o.employeeId}
                              onClick={() => toggleStaffSelection(o.employeeId)}
                              className={`p-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer text-xs ${
                                isSelected ? 'bg-emerald-50/60 font-semibold' : ''
                              }`}
                            >
                              <div className="truncate mr-2">
                                <span className="font-mono text-slate-600">{o.employeeId}</span>
                                <span className="mx-1.5">•</span>
                                <span className="text-slate-900">{o.name}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({o.designation})</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded text-emerald-600 focus:ring-emerald-500 pointer-events-none shrink-0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* External Participants */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          External Participants
                        </label>
                        <span className="text-[10px] text-slate-400">No Employee ID</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Sneha Patel (MSc Nursing Trainee)..."
                          value={externalStaffInput}
                          onChange={(e) => setExternalStaffInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddExternalStaff();
                            }
                          }}
                          className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddExternalStaff}
                          className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold rounded-lg text-xs cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                      {externalStaffList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1 max-h-20 overflow-y-auto">
                          {externalStaffList.map((staff, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200"
                            >
                              <span>{staff} (External)</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveExternalStaff(idx)}
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

              {/* Sticky Footer */}
              <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-end bg-slate-50/70 shrink-0">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
                      <span>Saving CNE...</span>
                    </>
                  ) : (
                    <span>Save CNE</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. EDIT CNE Modal (Replacing Inline Edit)                 */}
      {/* ========================================================= */}
      {editingRecord && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5">
          <div className="bg-white rounded-2xl w-[92vw] max-w-[1440px] max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 relative overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center shrink-0">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Edit CNE Record</h3>
                  <p className="text-xs text-slate-500">Update session details, resource persons, and participants</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditingRecord(null)}
                disabled={isEditSubmitting}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-40 cursor-pointer transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="flex flex-col flex-1 overflow-hidden">
              <div className="p-6 overflow-y-auto flex-1 space-y-4 text-xs">
                {/* 4 Logical Sections organized into a responsive grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
                  {/* Section 1: Classification & CNE Details */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 border-b border-purple-100 pb-2 flex items-center gap-1.5">
                      <span>1. Classification &amp; CNE Details</span>
                    </h4>

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
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      />
                    </div>

                    {/* Type of CNE */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Type of CNE *
                      </label>
                      <select
                        required
                        value={editCneType}
                        onChange={(e) => setEditCneType(e.target.value as any)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        <option value="CENTRAL">Central CNE</option>
                        <option value="DEPARTMENTAL">Departmental CNE</option>
                      </select>
                    </div>

                    {/* Ward Name / Area */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Ward Name / Area *
                      </label>
                      <select
                        required
                        value={editArea}
                        onChange={(e) => setEditArea(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        <option value="">Select Ward / Area...</option>
                        {activeAreas.map((a) => (
                          <option key={a.id} value={a.name}>{a.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Mode of Teaching */}
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Mode of Teaching
                      </label>
                      <select
                        value={editMode}
                        onChange={(e) => setEditMode(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none"
                      >
                        {teachingModes.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>

                    {/* Remarks / Notes */}
                    <div className="flex-1 flex flex-col">
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                        Remarks / Notes
                      </label>
                      <textarea
                        rows={3}
                        value={editRemarks}
                        onChange={(e) => setEditRemarks(e.target.value)}
                        placeholder="Additional skills notes, simulation equipment used..."
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-purple-500 focus:outline-none flex-1"
                      />
                    </div>
                  </div>

                  {/* Section 2: Date, Time & Duration */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900 border-b border-indigo-100 pb-2 flex items-center gap-1.5">
                      <span>2. Date, Time &amp; Duration</span>
                    </h4>

                    {/* Dates & Duration via CneDateTimeFields */}
                    <CneDateTimeFields
                      idPrefix="activity-edit"
                      fromDate={editFromDate}
                      fromTime={editFromTime}
                      toDate={editToDate}
                      toTime={editToTime}
                      layout="stack"
                      accentColor="emerald"
                      onChange={({ fromDate, fromTime, toDate, toTime, calculatedDuration }) => {
                        setEditFromDate(fromDate);
                        setEditFromTime(fromTime);
                        setEditToDate(toDate);
                        setEditToTime(toTime);
                        if (calculatedDuration && calculatedDuration !== '00:00:00') {
                          setEditDuration(calculatedDuration);
                        }
                      }}
                    />

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                          Duration (HH:MM:SS) *
                        </label>
                        <span className="text-[10px] text-emerald-700 font-semibold">Auto-calculated</span>
                      </div>
                      <input
                        type="text"
                        required
                        placeholder="00:00:00"
                        value={editDuration}
                        onChange={(e) => setEditDuration(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                      />
                      <p className="text-[10px] text-slate-500 mt-1">
                        Calculated automatically from selected dates and times. Max 8 hrs/day. Format: HH:MM:SS
                      </p>
                    </div>
                  </div>

                  {/* Section 3: Resource Persons */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-teal-900 border-b border-teal-100 pb-2 flex items-center justify-between">
                      <span>3. Resource Persons</span>
                      <span className="text-xs font-bold text-teal-800 bg-teal-100 px-2 py-0.5 rounded-full">
                        Selected: {editRpEmpIds.length}
                      </span>
                    </h4>

                    {/* Internal Resource Persons */}
                    <div className="space-y-2 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Resource Person(s) / Instructors *
                        </label>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Filter resource persons by name or ID..."
                          value={editRpSearchQuery}
                          onChange={(e) => setEditRpSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
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
                                <span>{off ? off.name : id} <span className="text-[10px] text-purple-700 opacity-75 font-mono">({id})</span></span>
                                <button
                                  type="button"
                                  onClick={() => toggleEditRpSelection(id)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* RP Selection List */}
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white flex-1">
                        {filteredEditRpOptions.slice(0, 50).map((o) => {
                          const isSelected = editRpEmpIds.includes(o.employeeId);
                          return (
                            <div
                              key={o.employeeId}
                              onClick={() => toggleEditRpSelection(o.employeeId)}
                              className={`p-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer text-xs ${
                                isSelected ? 'bg-purple-50/60 font-semibold' : ''
                              }`}
                            >
                              <div className="truncate mr-2">
                                <span className="font-mono text-slate-600">{o.employeeId}</span>
                                <span className="mx-1.5">•</span>
                                <span className="text-slate-900">{o.name}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({o.designation})</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded text-purple-600 focus:ring-purple-500 pointer-events-none shrink-0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* External Resource Persons */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          External Resource Persons
                        </label>
                        <span className="text-[10px] text-slate-400">No Employee ID</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Prof. R. Sharma (PGI Chandigarh)..."
                          value={editExternalRpInput}
                          onChange={(e) => setEditExternalRpInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddEditExternalRp();
                            }
                          }}
                          className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddEditExternalRp}
                          className="px-3 py-1.5 bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold rounded-lg text-xs cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                      {editExternalRpList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1 max-h-20 overflow-y-auto">
                          {editExternalRpList.map((rp, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-amber-50 text-amber-900 px-2 py-0.5 rounded-md border border-amber-200"
                            >
                              <span>{rp} (External)</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveEditExternalRp(idx)}
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

                  {/* Section 4: Participants */}
                  <div className="space-y-3.5 bg-slate-50/60 p-4 rounded-xl border border-slate-200 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-900 border-b border-emerald-100 pb-2 flex items-center justify-between">
                      <span>4. Participants</span>
                      <span className="text-xs font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                        Selected: {editStaffIds.length}
                      </span>
                    </h4>

                    {/* Internal Participants */}
                    <div className="space-y-2 flex-1 flex flex-col">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          Participants
                        </label>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                        <input
                          type="text"
                          placeholder="Filter staff by name or employee ID..."
                          value={editStaffSearchQuery}
                          onChange={(e) => setEditStaffSearchQuery(e.target.value)}
                          className="w-full pl-8 pr-2 py-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
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
                                <span>{off ? off.name : id} <span className="text-[10px] text-slate-500 opacity-75 font-mono">({id})</span></span>
                                <button
                                  type="button"
                                  onClick={() => toggleEditStaffSelection(id)}
                                  className="hover:text-rose-600 cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                </button>
                              </span>
                            );
                          })}
                        </div>
                      )}

                      {/* Staff Selection List */}
                      <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 bg-white flex-1">
                        {filteredEditStaffOptions.slice(0, 50).map((o) => {
                          const isSelected = editStaffIds.includes(o.employeeId);
                          return (
                            <div
                              key={o.employeeId}
                              onClick={() => toggleEditStaffSelection(o.employeeId)}
                              className={`p-2 flex items-center justify-between hover:bg-slate-50 cursor-pointer text-xs ${
                                isSelected ? 'bg-emerald-50/60 font-semibold' : ''
                              }`}
                            >
                              <div className="truncate mr-2">
                                <span className="font-mono text-slate-600">{o.employeeId}</span>
                                <span className="mx-1.5">•</span>
                                <span className="text-slate-900">{o.name}</span>
                                <span className="text-slate-400 text-[10px] ml-1">({o.designation})</span>
                              </div>
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => {}}
                                className="rounded text-emerald-600 focus:ring-emerald-500 pointer-events-none shrink-0"
                              />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* External Participants */}
                    <div className="pt-2 border-t border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                          External Participants
                        </label>
                        <span className="text-[10px] text-slate-400">No Employee ID</span>
                      </div>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          placeholder="e.g. Sneha Patel (MSc Nursing Trainee)..."
                          value={editExternalStaffInput}
                          onChange={(e) => setEditExternalStaffInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleAddEditExternalStaff();
                            }
                          }}
                          className="flex-1 p-2 bg-white border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={handleAddEditExternalStaff}
                          className="px-3 py-1.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-900 font-semibold rounded-lg text-xs cursor-pointer"
                        >
                          + Add
                        </button>
                      </div>
                      {editExternalStaffList.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mt-1 max-h-20 overflow-y-auto">
                          {editExternalStaffList.map((staff, idx) => (
                            <span
                              key={idx}
                              className="inline-flex items-center gap-1 text-[11px] font-medium bg-emerald-50 text-emerald-900 px-2 py-0.5 rounded-md border border-emerald-200"
                            >
                              <span>{staff} (External)</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveEditExternalStaff(idx)}
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

              {/* Sticky Footer */}
              <div className="px-6 py-3.5 border-t border-slate-200 flex items-center justify-between bg-slate-50/70 shrink-0">
                <button
                  type="button"
                  onClick={() => setDeletingRecord(editingRecord)}
                  disabled={isEditSubmitting}
                  className="flex items-center gap-1.5 px-3.5 py-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl font-bold text-xs transition-colors cursor-pointer disabled:opacity-40"
                  title="Delete this CNE record"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Delete</span>
                </button>
                <button
                  type="submit"
                  disabled={isEditSubmitting}
                  className="flex items-center gap-1.5 px-5 py-2 bg-slate-900 text-white rounded-xl font-bold text-xs hover:bg-slate-800 disabled:opacity-50 cursor-pointer transition-colors shadow-xs"
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
              <h3 className="text-base font-bold text-slate-900">Delete CNE Record?</h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to delete the CNE record for <strong className="text-slate-800">"{deletingRecord.topic}"</strong> held on <strong className="text-slate-800">{formatCneDateRangeDisplay(deletingRecord.fromDate, deletingRecord.toDate)}</strong>? This will remove participation records from connected staff portfolios.
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

      {/* ========================================================= */}
      {/* 4. Verify / Initialize CNE Sheets Modal (Admin Only)      */}
      {/* ========================================================= */}
      {isVerifyModalOpen && user.role === 'ADMIN' && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          {isVerifying ? (
            <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-xl border border-slate-200 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-indigo-50 text-indigo-600 mx-auto flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Verifying...</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Verifying configured CNE Google Spreadsheet tabs and headers. Please wait...
                </p>
              </div>
            </div>
          ) : verifyReport !== null ? (
            <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl border border-slate-200 space-y-4 max-h-[90vh] flex flex-col">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h3 className="text-base font-bold text-slate-900">
                    CNE Sheets verification completed successfully.
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    All 13 authoritative CNE tabs and required headers were verified. Existing records remained completely untouched.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyModalOpen(false);
                    setVerifyReport(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 p-1 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Audit Report Table */}
              <div className="flex-1 overflow-y-auto min-h-0 border border-slate-200 rounded-xl">
                <table className="w-full text-left text-xs text-slate-700">
                  <thead className="bg-slate-50 text-slate-500 font-semibold border-b border-slate-200 uppercase tracking-wider text-[10px] sticky top-0">
                    <tr>
                      <th className="px-3 py-2.5">Tab Name</th>
                      <th className="px-3 py-2.5">Status</th>
                      <th className="px-3 py-2.5 text-right">Row Count</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {verifyReport.length === 0 ? (
                      <tr>
                        <td colSpan={3} className="px-3 py-4 text-center text-slate-400">
                          No audit entries returned.
                        </td>
                      </tr>
                    ) : (
                      verifyReport.map((item, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-3 py-2.5 font-medium text-slate-900 whitespace-nowrap">
                            {item.tab}
                          </td>
                          <td className="px-3 py-2.5">
                            {item.error ? (
                              <span className="text-amber-600 font-medium">{item.status} ({item.error})</span>
                            ) : item.status.toLowerCase().includes('created') ? (
                              <span className="text-emerald-700 font-medium bg-emerald-50 px-2 py-0.5 rounded-md text-[11px]">{item.status}</span>
                            ) : item.status.toLowerCase().includes('appended') ? (
                              <span className="text-blue-700 font-medium bg-blue-50 px-2 py-0.5 rounded-md text-[11px]">{item.status}</span>
                            ) : (
                              <span className="text-slate-700">{item.status}</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-slate-500 tabular-nums">
                            {item.rowCount !== undefined ? item.rowCount : '—'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-slate-400">
                  {verifyReport.length} tab{verifyReport.length === 1 ? '' : 's'} reported
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyModalOpen(false);
                    setVerifyReport(null);
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          ) : verifyError !== null ? (
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Verification Failed</h3>
                  <p className="text-xs text-slate-500 mt-0.5">The backend reported an error during verification:</p>
                </div>
              </div>
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 whitespace-pre-wrap font-mono">
                {verifyError}
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setIsVerifyModalOpen(false);
                    setVerifyError(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          ) : (
            /* Confirmation Dialog */
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-200 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Verify / Initialize CNE Sheets</h3>
                  <p className="text-xs text-slate-500">Sheet Structure Check</p>
                </div>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed space-y-2">
                <p className="font-semibold text-slate-900">Verify / Initialize CNE Sheets?</p>
                <p>
                  This will verify the configured CNE Sheets and create any missing tabs or required headers.
                </p>
                <p className="text-slate-600">
                  Existing sheet data will not be deleted, cleared, reordered, or replaced.
                </p>
                <p className="font-semibold text-slate-900 pt-1">
                  Continue?
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsVerifyModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-admin-confirm-verify"
                  type="button"
                  onClick={handleExecuteVerifySheets}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg cursor-pointer transition-colors shadow-xs"
                >
                  <span>Continue</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
